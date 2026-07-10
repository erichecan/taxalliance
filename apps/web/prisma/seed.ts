// 种子数据：一个记账公司 + 一个会计师 + 一个客户（未连 QBO）+ 科目表 + 一条规则。
// 幂等，可重复运行。跑：npx tsx prisma/seed.ts
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { inboundEmailFor } from "@/domain";

const FIRM_ID = "firm-demo";
const CLIENT_ID = "client-demo";
const DEMO_EMAIL = "demo@easetax.ca";
const DEMO_PASSWORD = "easetax-demo"; // 仅 dev 种子；上线换

// 模拟客户 QBO 科目表（id = QBO Account.Id，契约 G2）。
// 一套典型加拿大小企业费用科目——名字含类别关键词，供 vendor-seed 按类别定位。
const ACCOUNTS = [
  { id: "7", name: "Office Supplies 办公用品" },
  { id: "12", name: "Telephone & Internet 电话网络" },
  { id: "19", name: "Rent Expense 租金" },
  { id: "23", name: "Meals & Entertainment 餐饮招待" },
  { id: "31", name: "Software & Subscriptions 软件订阅" },
  { id: "40", name: "Utilities 水电杂费" },
  { id: "45", name: "Vehicle & Fuel 汽车油费" },
  { id: "50", name: "Repairs & Maintenance 维修保养" },
  { id: "55", name: "Travel 差旅交通" },
  { id: "60", name: "Insurance 保险" },
  { id: "65", name: "Shipping & Postage 运费邮寄" },
  { id: "70", name: "Bank Charges & Merchant Fees 银行手续费" },
  { id: "75", name: "Advertising & Promotion 广告推广" },
  { id: "80", name: "Professional Fees 专业服务费" },
  { id: "85", name: "Cost of Goods Sold 销货成本" },
  { id: "90", name: "Supplies & Materials 材料耗材" },
  { id: "44", name: "General Expenses 一般费用" },
];

async function main() {
  const firm = await prisma.firm.upsert({
    where: { id: FIRM_ID },
    update: {},
    create: { id: FIRM_ID, name: "易账 Demo 记账公司" },
  });

  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {},
    create: { firmId: firm.id, email: DEMO_EMAIL, passwordHash: hashPassword(DEMO_PASSWORD), role: "accountant" },
  });

  await prisma.client.upsert({
    where: { id: CLIENT_ID },
    update: {},
    create: {
      id: CLIENT_ID,
      firmId: firm.id,
      name: "Maple Leaf Dental",
      industry: "牙科诊所",
      inboundEmail: inboundEmailFor(CLIENT_ID),
      qboRealmId: null, // 未连 QBO（一等状态）
    },
  });

  for (const a of ACCOUNTS) {
    await prisma.glAccountCache.upsert({
      where: { clientId_qboAccountId: { clientId: CLIENT_ID, qboAccountId: a.id } },
      update: { name: a.name },
      create: { clientId: CLIENT_ID, qboAccountId: a.id, name: a.name, accountType: "Expense" },
    });
  }

  // 一条规则演示「规则优先」：描述含 shopify → 软件订阅
  await prisma.classificationRule.deleteMany({ where: { firmId: firm.id } });
  await prisma.classificationRule.create({
    data: {
      firmId: firm.id,
      clientId: CLIENT_ID,
      matchType: "keyword",
      matchValue: "shopify",
      glAccountId: "31",
      glAccountName: "Software & Subscriptions 软件订阅",
    },
  });

  console.log("✅ seed 完成");
  console.log(`   Firm: ${firm.name} (${firm.id})`);
  console.log(`   User: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`   Client: Maple Leaf Dental (${CLIENT_ID}) 收单邮箱 ${inboundEmailFor(CLIENT_ID)}`);
  console.log(`   科目 ${ACCOUNTS.length} 个，规则 1 条`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
