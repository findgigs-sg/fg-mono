import { sql } from "drizzle-orm";

import { JOB_CATEGORIES } from "@findgigs/validators";

import { db } from "./client";
import { JobCategory } from "./schema";

async function main() {
  const rows = JOB_CATEGORIES.map((c, index) => ({
    slug: c.slug,
    label: c.label,
    sortOrder: index,
  }));

  await db
    .insert(JobCategory)
    .values(rows)
    .onConflictDoUpdate({
      target: JobCategory.slug,
      set: {
        label: sql`excluded.label`,
        sortOrder: sql`excluded.sort_order`,
      },
    });

  console.log(`Seeded ${rows.length} job categories.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
