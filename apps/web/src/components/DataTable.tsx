import type { ReactNode } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { EmptyState, ErrorState, LoadingState } from './Feedback';

export interface TableColumn<Row> {
  id: string;
  label: string;
  render: (row: Row) => ReactNode;
  align?: 'left' | 'right';
}
interface Props<Row> {
  caption: string;
  columns: TableColumn<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription: string;
}
/** Display only: server pagination, filtering, and salary logic belong to feature modules. */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
}: Props<Row>) {
  if (loading)
    return <LoadingState label={`Loading ${caption.toLowerCase()}…`} />;
  if (error)
    return <ErrorState message={error} {...(onRetry ? { onRetry } : {})} />;
  if (!rows.length)
    return (
      <Paper variant="outlined">
        <EmptyState title={emptyTitle} description={emptyDescription} />
      </Paper>
    );
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      tabIndex={0}
      role="region"
      aria-label={caption}
      sx={{ maxWidth: '100%' }}
    >
      <Table>
        <caption style={{ captionSide: 'top', padding: 16 }}>{caption}</caption>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.id}
                scope="col"
                align={column.align ?? 'left'}
              >
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => (
                <TableCell key={column.id} align={column.align ?? 'left'}>
                  {column.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
