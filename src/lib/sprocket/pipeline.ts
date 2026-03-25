import { addDoc, collection, serverTimestamp, Firestore } from 'firebase/firestore';

export type SprocketLeadForPipeline = {
  email?: string | null;
  dealership?: string | null;
  intent?: string | null;
  created_at?: unknown;
  name?: string | null;
};

export async function convertSprocketLeadToPipeline(
  firestore: Firestore,
  lead: SprocketLeadForPipeline,
): Promise<string> {
  const ref = await addDoc(collection(firestore, 'dealer_pipeline'), {
    contact_email: String(lead.email || '').trim(),
    dealership_name: String(lead.dealership || '').trim(),
    lead_source: String(lead.intent || '').trim(),
    created_at: lead.created_at || serverTimestamp(),
    source: 'sprocket_chat',
    contact_name: String(lead.name || '').trim(),
    stage: 'lead',
  });

  return ref.id;
}

