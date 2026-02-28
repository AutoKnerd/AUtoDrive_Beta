import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/firebase/admin";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Lazy-load Timestamp to avoid firebase-admin being imported at build-time
const getTimestamp = async () => {
  const { Timestamp } = await import('firebase-admin/firestore');
  return Timestamp;
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
    const { token } = await params;
    if (!token) {
        return NextResponse.json({ message: 'Invitation token is missing.' }, { status: 400 });
    }

    try {
        const adminDb = getAdminDb();
        const inviteRef = adminDb.collection('emailInvitations').doc(token);
        const inviteSnap = await inviteRef.get();

        if (!inviteSnap.exists) {
            return NextResponse.json({ message: 'This invitation is not valid.' }, { status: 404 });
        }

        const invitation = inviteSnap.data() as any;

        if (invitation.claimed) {
            return NextResponse.json({ message: 'This invitation has already been claimed.' }, { status: 410 });
        }
        
        if (invitation.expiresAt?.toDate && invitation.expiresAt.toDate() < new Date()) {
            return NextResponse.json({ message: 'This invitation has expired.' }, { status: 410 });
        }
        
        // Return the full invitation object if it's valid
        return NextResponse.json({ ...invitation, token: inviteSnap.id });

    } catch (e: any) {
      console.error(`[API ValidateInvitation] Error for token ${token}:`, e);

      if (e && e.code === 'admin/not-initialized') {
        return NextResponse.json({ message: e.message }, { status: 503 });
      }

      return NextResponse.json({ message: 'Internal Server Error while validating invitation.' }, { status: 500 });
    }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ message: "Missing Authorization header" }, { status: 401 });

  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match?.[1]) return NextResponse.json({ message: "Invalid Authorization header" }, { status: 401 });

  const { token: bodyToken } = await req.json().catch(() => ({}));
  if (!bodyToken) return NextResponse.json({ message: "Missing invitation token" }, { status: 400 });

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decoded = await adminAuth.verifyIdToken(match[1].trim());
    const uid = decoded.uid;
    const authedEmail = (decoded.email || "").toLowerCase();

    if (!authedEmail) {
      return NextResponse.json({ message: "Authenticated user has no email" }, { status: 400 });
    }

    const inviteRef = adminDb.collection("emailInvitations").doc(bodyToken);

    await adminDb.runTransaction(async (tx: any) => {
      // === PHASE 1: All reads must happen first ===
      const inviteSnap = await tx.get(inviteRef);
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await tx.get(userRef);

      // Validate invitation
      if (!inviteSnap.exists) throw new Error("Invitation not found");

      const invite = inviteSnap.data() as any;

      if (invite.claimed) throw new Error("Invitation already claimed");
      if ((invite.email || "").toLowerCase() !== authedEmail) throw new Error("Email does not match invitation");

      if (invite.expiresAt?.toDate && invite.expiresAt.toDate() < new Date()) {
        throw new Error("Invitation expired");
      }

      // === PHASE 2: All writes happen after reads ===
      const Timestamp = await getTimestamp();
      
      // Mark invitation as claimed
      tx.update(inviteRef, {
        claimed: true,
        claimedAt: Timestamp.now(),
        claimedBy: uid,
      });

      // Create or update user profile
      const dealershipId = invite.dealershipId;
      const role = invite.role;

      if (!userSnap.exists) {
        tx.set(userRef, {
          userId: uid,
          email: authedEmail,
          name: decoded.name ?? "",
          role,
          dealershipIds: dealershipId ? [dealershipId] : [],
          isPrivate: false,
          isPrivateFromOwner: false,
          showDealerCriticalOnly: false,
          memberSince: new Date().toISOString(),
          xp: 0,
          subscriptionStatus: ["Owner", "General Manager", "Trainer", "Admin", "Developer"].includes(role)
            ? "active"
            : "inactive",
        });
      } else {
        // Add dealership if missing
        const existing = userSnap.data() as any;
        const existingIds: string[] = existing.dealershipIds || [];
        const nextIds = dealershipId && !existingIds.includes(dealershipId)
          ? [...existingIds, dealershipId]
          : existingIds;

        tx.update(userRef, {
          dealershipIds: nextIds,
          role: existing.role || role,
        });
      }
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error('[API ClaimInvitation] Error:', { message: e?.message, code: e?.code, stack: e?.stack });

    if (e && e.code === 'admin/not-initialized') {
      return NextResponse.json({ message: e.message }, { status: 503 });
    }

    return NextResponse.json({ message: e.message || "Failed to claim invitation" }, { status: 400 });
  }
}
