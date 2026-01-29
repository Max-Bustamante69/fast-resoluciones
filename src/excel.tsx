// excel.ts
import * as XLSX from "xlsx";

export type Row = Record<string, any>;

export function readWorkbook(file: File) {
  return file.arrayBuffer().then((buf) => XLSX.read(buf, { type: "array" }));
}

export function sheetToJson(wb: XLSX.WorkBook): {
  ws: XLSX.WorkSheet;
  data: Row[];
  name: string;
} {
  const name = wb.SheetNames[0];
  const ws = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json<Row>(ws, { defval: "" });
  return { ws, data, name };
}

export function writeRows(wb: XLSX.WorkBook, sheetName: string, rows: Row[]) {
  const ws = XLSX.utils.json_to_sheet(rows);
  wb.Sheets[sheetName] = ws;
}

export function downloadWorkbook(
  wb: XLSX.WorkBook,
  filename = "resultado.xlsx",
) {
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
