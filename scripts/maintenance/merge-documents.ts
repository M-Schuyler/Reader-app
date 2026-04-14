import { PrismaClient, DocumentType, ReadState } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";

const prisma = new PrismaClient();

// Configuration
const DRY_RUN = process.env.CONFIRM_DELETE !== "true";
const BACKUP_DIR = path.join(process.cwd(), "tmp/backups");

async function main() {
  const timestamp = Date.now();
  console.log(`🚀 Starting ENHANCED Document Merge & Cleanup (${DRY_RUN ? "DRY RUN" : "LIVE EXECUTION"})`);

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 1. Fetch FULL data for all documents with dedupeKey
  const allDocs = await prisma.document.findMany({
    where: {
      dedupeKey: { not: null },
    },
    include: {
      tags: { include: { tag: true } },
      highlights: true,
      content: true,
    },
  });

  const groups = new Map<string, typeof allDocs>();
  for (const doc of allDocs) {
    const key = doc.dedupeKey!;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(doc);
  }

  const duplicateGroups = Array.from(groups.entries()).filter(([_, items]) => items.length > 1);

  if (duplicateGroups.length === 0) {
    console.log("✅ No duplicates found. Database is clean.");
    return;
  }

  console.log(`📊 Found ${duplicateGroups.length} groups of duplicates.`);

  const mergePlan: any[] = [];
  const fullBackup: any = { timestamp, groups: [] };

  // 2. Build the detailed plan
  for (const [key, items] of duplicateGroups) {
    const sorted = [...items].sort((a, b) => {
      if (b.highlights.length !== a.highlights.length) return b.highlights.length - a.highlights.length;
      if (!!b.aiSummary !== !!a.aiSummary) return b.aiSummary ? -1 : 1;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const winner = sorted[0];
    const losers = sorted.slice(1);

    // Analyze Tags
    const winnerTagSlugs = new Set(winner.tags.map(t => t.tag.slug));
    const tagsToMigrate: string[] = [];
    for (const loser of losers) {
      for (const lt of loser.tags) {
        if (!winnerTagSlugs.has(lt.tag.slug)) {
          tagsToMigrate.push(lt.tag.name);
          winnerTagSlugs.add(lt.tag.slug);
        }
      }
    }

    // Analyze Read State
    const willBecomeRead = losers.some(l => l.readState === ReadState.READ) && winner.readState !== ReadState.READ;

    const plan = {
      key,
      winner: {
        id: winner.id,
        title: winner.title,
        sourceUrl: winner.sourceUrl,
        readState: winner.readState,
        highlightsCount: winner.highlights.length,
        tags: winner.tags.map(t => t.tag.name),
      },
      losers: losers.map(l => ({
        id: l.id,
        title: l.title,
        sourceUrl: l.sourceUrl,
        readState: l.readState,
        highlightsCount: l.highlights.length,
        tags: l.tags.map(t => t.tag.name),
      })),
      migration: {
        highlightsToMove: losers.reduce((sum, l) => sum + l.highlights.length, 0),
        newTagsToAdd: [...new Set(tagsToMigrate)],
        updateReadState: willBecomeRead,
      }
    };

    mergePlan.push(plan);
    fullBackup.groups.push({ key, winner, losers });
  }

  // 3. Output Enhanced Report
  console.log("\n📋 ENHANCED DRY-RUN MERGE REPORT");
  console.log("===============================================");
  
  let globalLosersCount = 0;
  let globalHighlightsMoved = 0;

  for (const plan of mergePlan) {
    console.log(`\n📄 Winner: "${plan.winner.title}"`);
    console.log(`   ID: ${plan.winner.id}`);
    console.log(`   URL: ${plan.winner.sourceUrl}`);
    console.log(`   Key: ${plan.key}`);
    console.log(`   [Current State] Highlights: ${plan.winner.highlightsCount}, Tags: [${plan.winner.tags.join(", ")}], State: ${plan.winner.readState}`);
    
    if (plan.migration.highlightsToMove > 0 || plan.migration.newTagsToAdd.length > 0 || plan.migration.updateReadState) {
      console.log(`   ⚡ MERGE ACTIONS:`);
      if (plan.migration.highlightsToMove > 0) console.log(`      - Move ${plan.migration.highlightsToMove} highlights from losers.`);
      if (plan.migration.newTagsToAdd.length > 0) console.log(`      - Add tags: [${plan.migration.newTagsToAdd.join(", ")}]`);
      if (plan.migration.updateReadState) console.log(`      - Change state to READ`);
    }

    for (const loser of plan.losers) {
      console.log(`   🗑️  To Delete: ${loser.id} (URL: ${loser.sourceUrl})`);
      globalLosersCount++;
    }
    globalHighlightsMoved += plan.migration.highlightsToMove;
  }

  console.log("\n📊 Verification Metrics (Expected):");
  console.log(`- Total groups to merge: ${mergePlan.length}`);
  console.log(`- Total documents to be REMOVED: ${globalLosersCount}`);
  console.log(`- Total highlights to be RE-LINKED: ${globalHighlightsMoved}`);
  console.log(`- Net document count change: -${globalLosersCount}`);

  // 4. Save TRUE FULL BACKUP
  const backupPath = path.join(BACKUP_DIR, `full-merge-backup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(fullBackup, null, 2));
  console.log(`\n💾 TRUE FULL BACKUP (all fields + content) saved to: ${backupPath}`);
  console.log(`   This file can be used for manual rollback via 'prisma.document.create'.`);

  if (DRY_RUN) {
    console.log("\n⚠️  DRY RUN COMPLETED. No database changes were made.");
    console.log("   To execute the merge, run with: CONFIRM_DELETE=true npx tsx scripts/maintenance/merge-documents.ts");
  } else {
    console.log("\n🔥 INITIATING LIVE EXECUTION...");
    let successCount = 0;
    let failCount = 0;

    for (const plan of mergePlan) {
      const winnerId = plan.winner.id;
      const loserIds = plan.losers.map((l: any) => l.id);

      try {
        await prisma.$transaction(async (tx) => {
          // 1. Move Highlights
          if (plan.migration.highlightsToMove > 0) {
            await tx.highlight.updateMany({
              where: { documentId: { in: loserIds } },
              data: { documentId: winnerId },
            });
          }

          // 2. Add Missing Tags to Winner
          if (plan.migration.newTagsToAdd.length > 0) {
            const tagsToLink = await tx.tag.findMany({
              where: { name: { in: plan.migration.newTagsToAdd } },
            });
            
            for (const tag of tagsToLink) {
              // Upsert to ignore if it somehow already exists to prevent unique constraint errors
              await tx.documentTag.upsert({
                where: {
                  documentId_tagId: {
                    documentId: winnerId,
                    tagId: tag.id,
                  }
                },
                create: {
                  documentId: winnerId,
                  tagId: tag.id,
                },
                update: {}, // Do nothing if it exists
              });
            }
          }

          // 3. Update Read State if necessary
          if (plan.migration.updateReadState) {
            await tx.document.update({
              where: { id: winnerId },
              data: { readState: ReadState.READ },
            });
          }

          // 4. Delete Losers (Cascade handles DocumentContent, DocumentTag, IngestionJob, etc.)
          await tx.document.deleteMany({
            where: { id: { in: loserIds } },
          });
        });

        successCount++;
        console.log(`   ✅ Successfully merged group: ${plan.key}`);
      } catch (error) {
        failCount++;
        console.error(`   ❌ FAILED to merge group: ${plan.key}`);
        console.error(error);
      }
    }

    console.log("\n🏁 LIVE EXECUTION COMPLETE.");
    console.log(`   - Successful merges: ${successCount}/${mergePlan.length}`);
    if (failCount > 0) {
      console.log(`   - Failed merges: ${failCount} (Check logs above)`);
    } else {
      console.log(`   - All duplicates successfully resolved! You can now safely apply the @unique constraint on dedupeKey.`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
