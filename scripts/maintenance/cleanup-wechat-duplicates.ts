import { PrismaClient, DocumentType } from "@prisma/client";
import { generateDedupeKey, getWechatCanonicalUrl } from "../../src/lib/documents/dedupe";

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Scanning for duplicate WeChat articles...");

  const documents = await prisma.document.findMany({
    where: {
      type: DocumentType.WEB_PAGE,
      sourceUrl: {
        contains: "mp.weixin.qq.com",
      },
    },
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      canonicalUrl: true,
      createdAt: true,
      _count: {
        select: {
          highlights: true,
          tags: true,
        },
      },
    },
  });

  console.log(`📊 Found ${documents.length} WeChat documents in total.`);

  const groups = new Map<string, typeof documents>();

  for (const doc of documents) {
    const dedupeKey = generateDedupeKey({
      type: DocumentType.WEB_PAGE,
      sourceUrl: doc.sourceUrl,
      canonicalUrl: doc.canonicalUrl,
    });

    if (!dedupeKey) continue;

    if (!groups.has(dedupeKey)) {
      groups.set(dedupeKey, []);
    }
    groups.get(dedupeKey)!.push(doc);
  }

  let totalDuplicates = 0;
  const duplicateGroups: Array<{ key: string; items: typeof documents }> = [];

  for (const [key, items] of groups.entries()) {
    if (items.length > 1) {
      totalDuplicates += items.length - 1;
      duplicateGroups.push({ key, items });
    }
  }

  console.log(`✨ Identified ${duplicateGroups.length} groups of duplicates (Total ${totalDuplicates} redundant articles).`);

  if (duplicateGroups.length === 0) {
    console.log("✅ No duplicates found.");
    return;
  }

  console.log("\n📋 Duplicate Report (Candidates for deletion):");
  console.log("===============================================");

  for (const group of duplicateGroups) {
    // Sort items by priority: most highlights first, then oldest first
    const sorted = [...group.items].sort((a, b) => {
      if (b._count.highlights !== a._count.highlights) {
        return b._count.highlights - a._count.highlights;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const kept = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`\n📄 Title: "${kept.title}"`);
    console.log(`   ID to KEEP: ${kept.id} (Created: ${kept.createdAt.toISOString()}, Highlights: ${kept._count.highlights})`);
    console.log(`   Canonical URL: ${getWechatCanonicalUrl(kept.sourceUrl || kept.canonicalUrl || "")}`);
    
    for (const redundant of toDelete) {
      console.log(`   🗑️  Redundant ID: ${redundant.id} (Created: ${redundant.createdAt.toISOString()}, URL: ${redundant.sourceUrl})`);
    }
  }

  console.log("\n⚠️  Action required: Use the IDs above to delete redundant documents.");
  console.log("   Example: prisma.document.deleteMany({ where: { id: { in: [ids...] } } })");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
