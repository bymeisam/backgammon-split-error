import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { style, type TableCellKind } from "./Table.styles";

export type { TableCellKind };

// The app's data table, in the shared look: a card-like wrapper that
// scrolls sideways on a phone, uppercase faint headers, hairline rows,
// tabular figures in numeric cells. No hooks, so server and client
// components both use it.
//
//   <Table>
//     <TableHead>
//       <TableHeadCell>Opponent</TableHeadCell>
//       <TableHeadCell numeric>PR</TableHeadCell>
//     </TableHead>
//     <TableBody>
//       <TableRow>
//         <TableCell>{name}</TableCell>
//         <TableCell kind="numeric">{pr}</TableCell>
//       </TableRow>
//     </TableBody>
//   </Table>
//
// `className` on any of them adds the caller's own classes (from its own
// styles file), e.g. "max-md:hidden" on a column's head and body cells.
export function Table({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={style.wrapper(className)}>
      <table className={style.table}>{children}</table>
    </div>
  );
}

// The header row.
export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHeadCell({
  numeric = false,
  className,
  ...rest
}: { numeric?: boolean } & ThHTMLAttributes<HTMLTableCellElement>) {
  return <th {...rest} className={style.headCell(numeric, className)} />;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

// `clickable`: the whole row is a link (hover tint, pointer). Its main
// cell's <Link> carries shared.tableRowLink, which stretches it over the row.
export function TableRow({
  clickable = false,
  className,
  ...rest
}: { clickable?: boolean } & HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...rest} className={style.row(clickable, className)} />;
}

export function TableCell({
  kind = "text",
  className,
  ...rest
}: { kind?: TableCellKind } & TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...rest} className={style.cell(kind, className)} />;
}
