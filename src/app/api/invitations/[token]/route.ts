import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!authHeader) return NextResponse.json({ message: "Missing Authorization header" }, { status: 401 });

  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match?.[1]) return NextResponse.json({ message: "Invalid Authorization header" }, { status: 401 });

  const { token } = await req.json().catch(() => ({}));
  if (!token) return NextResponse.json({ message: "Missing invitation token" }, { status: 400 });

  try {
    const decoded = await adminAuth.verifyIdToken(match[1].trim());
    const uid = decoded.uid;
    const authedEmail = (decoded.email || "").toLowerCase();

    if (!authedEmail) {
      return NextResponse.json({ message: "Authenticated user has no email" }, { status: 400 });
    }

    const inviteRef = adminDb.collection("emailInvitations").doc(token);

    await adminDb.runTransaction(async (tx) => {
      const inviteSnap = await tx.get(inviteRef);
      if (!inviteSnap.exists) throw new Error("Invitation not found");

      const invite = inviteSnap.data() as any;

      if (invite.claimed) throw new Error("Invitation already claimed");
      if ((invite.email || "").toLowerCase() !== authedEmail) throw new Error("Email does not match invitation");

      if (invite.expiresAt?.toDate && invite.expiresAt.toDate() < new Date()) {
        throw new Error("Invitation expired");
      }

      // Mark claimed
      tx.update(inviteRef, {
        claimed: true,
        claimedAt: Timestamp.now(),
        claimedBy: uid,
      });

      // Create or update user profile
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await tx.get(userRef);

      const dealershipId = invite.dealershipId;
      const role = invite.role;

      if (!userSnap.exists) {
        tx.set(userRef, {
          userId: uid,
          email: authedEmail,
          name: decoded.name ?? "",
          role,
          dealershipIds: dealershipId ? [dealershipId] : [],
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
    return NextResponse.json({ message: e.message || "Failed to claim invitation" }, { status: 400 });
  }
}