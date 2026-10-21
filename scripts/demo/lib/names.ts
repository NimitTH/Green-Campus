// Seed people (R137). ALL NAMES HERE ARE FICTIONAL: common Thai given names paired with made-up,
// nature-themed surnames, chosen so that no combination refers to a real person or a public figure.
// tests/seed/seed.spec.ts checks that every seed profile's full_name comes from this file.

export const SEED_STUDENT_NAMES: readonly string[] = [
  "ธนกร ใบไม้งาม",
  "ปุณยวีร์ รักษ์ธารา",
  "ณัฐพล ดินดีสม",
  "ชนิดา ฟ้าใสสะอาด",
  "ภาคิน ต้นกล้าทอง",
  "กมลชนก ทุ่งเขียวขจี",
  "กฤษดา ธารน้ำเย็น",
  "ณิชา แสงตะวันใส",
  "ปัณณวัฒน์ ลมเย็นสบาย",
  "พิมพ์ชนก ป่าเขียวดี",
  "วรากร ดอกไม้บาน",
  "ศิริลักษณ์ เมฆขาวลอย",
  "ศุภกร ร่มไม้ใหญ่",
  "อรอุมา ใบไม้งาม",
  "ธีรภัทร รักษ์ธารา",
  "ธัญชนก ดินดีสม",
  "อนุชา ฟ้าใสสะอาด",
  "วรินทร ต้นกล้าทอง",
  "พีรพัฒน์ ทุ่งเขียวขจี",
  "ปวีณา ธารน้ำเย็น",
  "กันตภณ แสงตะวันใส",
  "มณีรัตน์ ลมเย็นสบาย",
  "ชยพล ป่าเขียวดี",
  "กัญญาณัฐ ดอกไม้บาน",
  "ณภัทร เมฆขาวลอย",
  "สุพิชชา ร่มไม้ใหญ่",
  "สิรวิชญ์ ใบไม้งาม",
  "นภัสสร รักษ์ธารา",
  "ภูริ ดินดีสม",
  "จิราพร ฟ้าใสสะอาด",
];

/** The three demo accounts (spec 8.3, 13.2), also fictional. */
export const DEMO_NAMES = {
  student: "นักเรียน สาธิต",
  teacher: "ครู สาธิต",
  admin: "ผู้ดูแล สาธิต",
} as const;
