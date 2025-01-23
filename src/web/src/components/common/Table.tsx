/**
 * @fileoverview Enhanced table component implementing Material Design principles
 * with features like sorting, pagination, virtualization, and accessibility.
 * @version 1.0.0
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
// @version 18.0.0
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TablePagination,
  Skeleton,
  Typography
} from '@mui/material'; // @version 5.0.0
import { styled } from '@mui/material/styles'; // @version 5.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // @version 3.0.0
import { PaginatedResponse } from '../../types/common.types';

// Types and interfaces
type SortDirection = 'asc' | 'desc';

interface Column {
  id: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  render?: (value: any) => React.ReactNode;
  ariaLabel?: string;
  headerClassName?: string;
  cellClassName?: string;
  hideOnMobile?: boolean;
}

interface TableProps<T> {
  columns: Column[];
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onSort?: (column: string, direction: SortDirection) => void;
  loading?: boolean;
  emptyMessage?: string;
  virtualScroll?: boolean;
  ariaLabel?: string;
  className?: string;
  testIds?: Record<string, string>;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
}

// Styled components
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: 8,
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  background: 'var(--color-background-paper)',
  overflow: 'auto',
  position: 'relative',
  minHeight: 200,
  '@media (max-width: 600px)': {
    padding: 0,
  },
  scrollbarWidth: 'thin',
  '&::-webkit-scrollbar': {
    width: 8,
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--color-scroll)',
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  padding: 'var(--spacing-sm)',
  borderBottom: '1px solid var(--color-secondary-light)',
  fontFamily: 'var(--font-family)',
  fontSize: 'var(--font-size-base)',
  '@media (max-width: 600px)': {
    padding: 'var(--spacing-xs)',
  },
  '&[data-hidden="true"]': {
    display: 'none',
  },
  '&:focus-visible': {
    outline: '2px solid var(--color-primary)',
  },
}));

// Main component
const Table = memo(<T extends Record<string, any>>(props: TableProps<T>) => {
  const {
    columns,
    data,
    total,
    page,
    pageSize,
    onPageChange,
    onSort,
    loading = false,
    emptyMessage = 'No data available',
    virtualScroll = false,
    ariaLabel = 'Data table',
    className,
    testIds = {},
    loadingComponent,
    emptyComponent,
  } = props;

  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Virtualization setup
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Approximate row height
    overscan: 5,
  });

  // Sort handler
  const handleSort = useCallback((columnId: string) => {
    const isAsc = sortColumn === columnId && sortDirection === 'asc';
    const newDirection = isAsc ? 'desc' : 'asc';
    setSortColumn(columnId);
    setSortDirection(newDirection);
    onSort?.(columnId, newDirection);
  }, [sortColumn, sortDirection, onSort]);

  // Page change handler
  const handlePageChange = useCallback((
    _: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    onPageChange(newPage, pageSize);
  }, [onPageChange, pageSize]);

  // Rows per page change handler
  const handleRowsPerPageChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    onPageChange(0, parseInt(event.target.value, 10));
  }, [onPageChange]);

  // Render loading state
  if (loading && loadingComponent) {
    return loadingComponent;
  }

  // Render empty state
  if (!loading && data.length === 0) {
    return emptyComponent || (
      <Typography
        variant="body1"
        align="center"
        color="textSecondary"
        data-testid={testIds.empty}
      >
        {emptyMessage}
      </Typography>
    );
  }

  return (
    <StyledTableContainer
      ref={parentRef}
      className={`table-responsive ${className || ''}`}
      data-testid={testIds.container}
    >
      <MuiTable aria-label={ariaLabel}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <StyledTableCell
                key={column.id}
                align={column.align}
                className={column.headerClassName}
                data-hidden={column.hideOnMobile}
                sortDirection={sortColumn === column.id ? sortDirection : false}
              >
                {column.sortable ? (
                  <TableSortLabel
                    active={sortColumn === column.id}
                    direction={sortColumn === column.id ? sortDirection : 'asc'}
                    onClick={() => handleSort(column.id)}
                    aria-label={column.ariaLabel || `Sort by ${column.label}`}
                  >
                    {column.label}
                  </TableSortLabel>
                ) : (
                  column.label
                )}
              </StyledTableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            // Loading skeleton
            Array.from({ length: pageSize }).map((_, index) => (
              <TableRow key={`skeleton-${index}`}>
                {columns.map((column) => (
                  <StyledTableCell
                    key={`skeleton-${column.id}`}
                    data-hidden={column.hideOnMobile}
                  >
                    <Skeleton variant="text" />
                  </StyledTableCell>
                ))}
              </TableRow>
            ))
          ) : virtualScroll ? (
            // Virtualized rows
            virtualizer.getVirtualItems().map((virtualRow) => {
              const row = data[virtualRow.index];
              return (
                <TableRow
                  key={virtualRow.index}
                  style={{
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {columns.map((column) => (
                    <StyledTableCell
                      key={column.id}
                      align={column.align}
                      className={`table-cell-truncate ${column.cellClassName || ''}`}
                      data-hidden={column.hideOnMobile}
                    >
                      {column.render ? column.render(row[column.id]) : row[column.id]}
                    </StyledTableCell>
                  ))}
                </TableRow>
              );
            })
          ) : (
            // Standard rows
            data.map((row, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <StyledTableCell
                    key={column.id}
                    align={column.align}
                    className={`table-cell-truncate ${column.cellClassName || ''}`}
                    data-hidden={column.hideOnMobile}
                  >
                    {column.render ? column.render(row[column.id]) : row[column.id]}
                  </StyledTableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </MuiTable>
      {total > pageSize && (
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={pageSize}
          onRowsPerPageChange={handleRowsPerPageChange}
          data-testid={testIds.pagination}
        />
      )}
    </StyledTableContainer>
  );
});

Table.displayName = 'Table';

export default Table;