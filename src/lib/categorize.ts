import type { Category } from "@prisma/client";

// Keyword → Category (tweak freely)
const KEYWORDS: Array<[RegExp, Category]> = [
  [/banana|apple|milk|bread|talenti|grocery|produce|snack|chips/i, "GROCERIES"],
  [/detergent|paper\s*towel|toilet|scott|cleaner|bag\s*fee|trash|target\s*bag/i, "HOUSEHOLD"],
  [/uber|lyft|gas|metro|bus|parking|toll/i, "TRANSPORT"],
  [/restaurant|cafe|coffee|latte|pizza|burger|fries/i, "DINING"],
  [/electric|water bill|wifi|internet|phone|utilities/i, "UTILITIES"],
  [/logitech|cable|charger|mouse|keyboard|batteries|adapter/i, "MISC"],
];

// Merchant defaults (fallback only)
const MERCHANT_DEFAULTS: Array<[RegExp, Category]> = [
  [/target|walmart|costco|aldi|kroger|tesco/i, "GROCERIES"],
  [/starbucks|mcdonald|chipotle|panera|dunkin/i, "DINING"],
];

// Match your Prisma Rule shape
type RuleLite = {
  triggerType: "MERCHANT_CONTAINS" | "DESC_CONTAINS" | "REGEX" | string;
  triggerValue: string;
  actionCategory: Category | null;
};

function fromRules(
  description: string,
  merchant: string | null,
  rules: RuleLite[]
): Category | null {
  const desc = description ?? "";
  const merch = merchant ?? "";

  for (const r of rules) {
    if (!r?.triggerValue) continue;
    let hit = false;

    switch (r.triggerType) {
      case "MERCHANT_CONTAINS":
        hit = merch.toLowerCase().includes(r.triggerValue.toLowerCase());
        break;
      case "DESC_CONTAINS":
        hit = desc.toLowerCase().includes(r.triggerValue.toLowerCase());
        break;
      case "REGEX":
        try {
          const re = new RegExp(r.triggerValue, "i");
          hit = re.test(`${merch} ${desc}`);
        } catch {
          /* ignore bad pattern */
        }
        break;
      default:
        // Treat unknown types as DESC_CONTAINS to be forgiving
        hit = desc.toLowerCase().includes(r.triggerValue.toLowerCase());
    }

    if (hit && r.actionCategory) return r.actionCategory;
  }
  return null;
}

export function suggestCategory(
  li: { descriptionRaw?: string | null },
  merchantRaw: string | null,
  rulesAny: RuleLite[]
): Category | null {
  const desc = li.descriptionRaw || "";

  // 1) User rules
  const ruleHit = fromRules(desc, merchantRaw, rulesAny);
  if (ruleHit) return ruleHit;

  // 2) Keywords
  for (const [re, cat] of KEYWORDS) {
    if (re.test(desc)) return cat;
  }

  // 3) Merchant fallback
  for (const [re, cat] of MERCHANT_DEFAULTS) {
    if (re.test(merchantRaw ?? "")) return cat;
  }

  return null;
}
