-- Green Campus: default waste categories and carbon rates (Task 5, spec 6.1-6.2).
--
-- carbon_kg_per_kg convention (same for all 4 groups):
--   kg CO2e saved per 1 kg of waste when recycling replaces virgin material, using the
--   TGO LESS-WM-01 v06 recycling factor ("ค่าการลดการปล่อยก๊าซเรือนกระจกสุทธิ ... รีไซเคิล
--   เพื่อทดแทนวัตถุดิบใหม่"). The avoided-landfill credit is EXCLUDED for ALL groups
--   (adding paper's landfill credit 2.1275 would give 5.6735; see docs/carbon-sources.md).
--   Waste that is not recycled (ขยะทั่วไป/อื่นๆ) replaces no virgin material, so it saves 0.
-- points_per_kg values are placeholders (ruling R16); admin may change them later (/staff/rates).
-- Full sources, years, URLs and how to change the values: docs/carbon-sources.md.
--
-- Idempotent: rows that already exist (by unique name) are left untouched, so values an
-- admin has edited are never overwritten by re-running this migration.

insert into public.waste_categories (name, points_per_kg, carbon_kg_per_kg, source_note) values
  ('พลาสติก', 10, 1.0310,
   'อบก. (TGO) LESS-WM-01 Version 06 การคัดแยกขยะเพื่อรีไซเคิล: ค่าการลดการปล่อยก๊าซเรือนกระจกสุทธิสำหรับการนำพลาสติกไปรีไซเคิลเพื่อทดแทนวัตถุดิบใหม่ 1.0310 kgCO2eq/kg ขยะ; ค่าอ่านจากเอกสารอบรมโครงการ LESS ของ อบก. "ตัวอย่างเอกสารการคำนวณการจัดการของเสีย" ปี 2567 (2024) ที่เผยแพร่บน https://www.tungtong.go.th/fileupload/2024-01-186630663778.pdf ; ยังไม่ได้เทียบกับไฟล์ Excel ทางการ LESS-WM-01 v06 ; หน้าวิธีการคำนวณ https://ghgreduction.tgo.or.th/th/calculation/less-calculate-document/less-waste/item/548-less-wm-01.html'),
  ('กระดาษ', 5, 3.5460,
   'อบก. (TGO) LESS-WM-01 Version 06 การคัดแยกขยะเพื่อรีไซเคิล: ค่าการลดการปล่อยก๊าซเรือนกระจกสุทธิสำหรับการนำกระดาษไปรีไซเคิลเพื่อทดแทนวัตถุดิบใหม่ 3.5460 kgCO2eq/kg ขยะ (ไม่รวมเครดิตการฝังกลบที่หลีกเลี่ยงได้ 2.1275 เหมือนทุกกลุ่ม ดู docs/carbon-sources.md); ค่าอ่านจากเอกสารอบรมโครงการ LESS ของ อบก. "ตัวอย่างเอกสารการคำนวณการจัดการของเสีย" ปี 2567 (2024) ที่เผยแพร่บน https://www.tungtong.go.th/fileupload/2024-01-186630663778.pdf ; ยังไม่ได้เทียบกับไฟล์ Excel ทางการ LESS-WM-01 v06 ; หน้าวิธีการคำนวณ https://ghgreduction.tgo.or.th/th/calculation/less-calculate-document/less-waste/item/548-less-wm-01.html'),
  ('โลหะ/แก้ว', 15, 0.2760,
   'ค่าประมาณ: ใช้ค่าของแก้วจาก อบก. (TGO) LESS-WM-01 Version 06 (ค่าการลดการปล่อยก๊าซเรือนกระจกสุทธิสำหรับการนำแก้วไปรีไซเคิล 0.2760 kgCO2eq/kg ขยะ, ปี 2567 https://www.tungtong.go.th/fileupload/2024-01-186630663778.pdf) กับทั้งกลุ่ม เพราะไม่พบค่าตัวเลขของโลหะ (อะลูมิเนียม/เหล็ก) ในเอกสาร อบก. ที่เข้าถึงได้ ผู้จัดทำคาดว่าการรีไซเคิลโลหะลดก๊าซได้มากกว่าแก้ว ค่านี้จึงน่าจะต่ำกว่าจริงเมื่อเป็นโลหะ (เป็นความคาดหมาย ยังไม่มีตัวเลขอ้างอิง)'),
  ('ขยะทั่วไป/อื่นๆ', 2, 0,
   'ค่าประมาณ: 0 kgCO2e/kg เพราะขยะทั่วไปไม่ได้ถูกนำไปรีไซเคิลและยังไปจบที่การฝังกลบเหมือนกรณีฐาน ไม่ได้ทดแทนวัตถุดิบใหม่ จึงไม่มีการลดก๊าซตามหลักการเดียวกับกลุ่มอื่น (ปริมาณที่ลดได้เมื่อรีไซเคิลทดแทนวัตถุดิบใหม่) และ อบก. ไม่มีค่าสำหรับขยะทั่วไป/ขยะผสม; แต้มยังให้เพื่อจูงใจการคัดแยก')
on conflict (name) do nothing;
