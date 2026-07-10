// 分类编排（DB 无关）：规则优先 → LLM/mock → Veryfi 文档级建议兜底。
import type { Classification, Classifier, ClassifyInput } from "./classifier";
import { matchRule, type RuleLike } from "./rule-matcher";
import { scoreToConfidence } from "./ocr";

export async function classifyLine(
  input: ClassifyInput,
  rules: RuleLike[],
  provider: Classifier,
): Promise<Classification> {
  // 1. 规则命中（high）
  const ruled = matchRule(input, rules);
  if (ruled) return ruled;

  // 2. LLM / mock 分类器
  const c = await provider.classify(input);
  if (c.glAccountId) return c;

  // 3. 兜底：Veryfi 文档级分类建议（LLM 未能定位科目时）
  if (input.suggestedCategory) {
    const s = input.suggestedCategory;
    return {
      glAccountId: s.glAccountId,
      glAccountName: s.glAccountName,
      confidence: scoreToConfidence(s.score),
      reason: `Veryfi 文档级分类建议（score ${s.score.toFixed(2)}）`,
      source: "veryfi",
    };
  }

  return c;
}
