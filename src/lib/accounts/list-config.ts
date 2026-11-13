import type { ListConfig } from "@/app/_components/list/list-params";

// DESIGN-4 6.1 (/staff/students): the list config, shared by the query (queries.ts -> staff_list_students) and the
// toolbar. The sort keys, directions and status values are the whitelists staff_list_students accepts (0036).

export const STUDENT_STATUS_LABEL_TH = {
  active: "ปกติ",
  suspended: "ถูกระงับ",
  must_change: "ต้องเปลี่ยนรหัสผ่าน",
} as const;

export const STUDENT_ACCOUNT_CONFIG = {
  sorts: {
    date: { label: "วันที่สมัคร", kind: "date", defaultDir: "desc" },
    name: { label: "ชื่อ", kind: "text", defaultDir: "asc" },
    points: { label: "แต้ม", kind: "number", defaultDir: "desc" },
  },
  defaultSort: "date",
  filters: { status: { label: "สถานะ", options: { ...STUDENT_STATUS_LABEL_TH } } },
} satisfies ListConfig;
