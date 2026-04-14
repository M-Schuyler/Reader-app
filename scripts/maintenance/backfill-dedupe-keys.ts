import { PrismaClient, DocumentType } from "@prisma/client";
import { generateDedupeKey } from "../../src/lib/documents/dedupe";

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting dedupeKey backfill...");

  const documents = await prisma.document.findMany({
    select: {
      id: true,
      type: true,
      sourceUrl: true,
      canonicalUrl: true,
      externalId: true,
      title: true,
    },
  });

  console.log(`📊 Found ${documents.length} documents to process.`);

  let updatedCount = 0;
  let conflictCount = 0;
  const keyToDocs = new Map<string, string[]>();

  for (const doc of documents) {
    const key = generateDedupeKey({
      type: doc.type,
      sourceUrl: doc.sourceUrl,
      canonicalUrl: doc.canonicalUrl,
      externalId: doc.externalId,
    });

    if (!key) continue;

    if (!keyToDocs.has(key)) {
      keyToDocs.set(key, []);
    }
    keyToDocs.get(key)!.push(doc.id);

    await prisma.document.update({
      where: { id: doc.id },
      data: { dedupeKey: key },
    });
    updatedCount++;

    if (updatedCount % 100 === 0) {
      console.log(`✅ Processed ${updatedCount} documents...`);
    }
  }

  console.log("\n📊 Backfill Summary:");
  console.log(`- Total processed: ${updatedCount}`);
  
  const conflicts: Array<{ key: string; ids: string[] }> = [];
  for (const [key, ids] of keyToDocs.entries()) {
    if (ids.length > 1) {
      conflictCount += ids.length - 1;
      conflicts.push({ key, ids });
    }
  }

  console.log(`- Total conflicts found: ${conflictCount} (across ${conflicts.length} unique keys)`);

  if (conflicts.length > 0) {
    console.log("\n⚠️  Conflict Audit (Samples):");
    for (const conflict of conflicts.slice(0, 10)) {
      console.log(`  🔑 Key: ${conflict.key}`);
      console.log(`     IDs: ${conflict.ids.join(", ")}`);
    }
    if (conflicts.length > 10) {
      console.log(`  ... and ${conflicts.length - 10} more conflict groups.`);
    }
  }

  console.log("\n✅ Backfill completed.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
