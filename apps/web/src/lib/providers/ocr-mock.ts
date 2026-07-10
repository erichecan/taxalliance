// Mock OCR：无外部依赖、确定性输出（按文件名派生），故意产出 high/medium/low
// 三档置信度以驱动复核流。密钥未配置时由 factory 选用。
import type { OcrExtraction, OcrInput, OcrProvider } from "./ocr";

function seedFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

const VENDORS = ["Staples Canada", "Bell Canada", "Uber Canada", "Costco Wholesale", "Shopify Inc."];

export class MockOcrProvider implements OcrProvider {
  readonly name = "mock-ocr";

  async extract(input: OcrInput): Promise<OcrExtraction> {
    const seed = seedFromName(input.fileName);
    const vendor = VENDORS[seed % VENDORS.length];
    const sub = 100 + (seed % 400); // 100–499 整数，避免浮点
    const tax = Math.round(sub * 0.13); // 演示用整数税，真实税走 QBO（契约 G6）
    const total = sub + tax;
    const d = new Date();
    const iso = (dt: Date) => dt.toISOString().slice(0, 10);

    return {
      vendorName: vendor,
      invoiceNo: `MOCK-${(seed % 100000).toString().padStart(5, "0")}`,
      txnDate: iso(d),
      dueDate: iso(new Date(d.getTime() + 30 * 86_400_000)),
      currency: "CAD",
      subTotal: sub.toFixed(2),
      taxAmount: tax.toFixed(2),
      total: total.toFixed(2),
      lines: [
        { description: "主要项目 / Line item A", amount: Math.round(sub * 0.6).toFixed(2) },
        { description: "次要项目 / Line item B", amount: (sub - Math.round(sub * 0.6)).toFixed(2) },
      ],
      overallConfidence: "medium",
      // 字段级：故意让 invoiceNo 低、vendor 高，模拟真实分布
      fieldConfidence: { vendorName: 0.95, invoiceNo: 0.45, total: 0.9, txnDate: 0.8 },
      suggestedCategory: null, // mock 不做文档级分类
      raw: { provider: "mock", fileName: input.fileName, note: "mock OCR，无外部调用" },
    };
  }
}
