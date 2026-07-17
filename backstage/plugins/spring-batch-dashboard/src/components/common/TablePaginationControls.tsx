import React from 'react';
import { Box, TablePagination } from '@mui/material';
import { PAGE_SIZE_OPTIONS, SELECT_MENU_PROPS } from '../../utils';

interface TablePaginationControlsProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
}

export const TablePaginationControls = ({
  count,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
}: TablePaginationControlsProps) => {
  const handleChangePage = (_: unknown, newPage: number) => {
    onPageChange(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    onRowsPerPageChange(parseInt(event.target.value, 10));
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
      <TablePagination
        component="div"
        count={count}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[...PAGE_SIZE_OPTIONS]}
        SelectProps={{
          MenuProps: SELECT_MENU_PROPS,
        }}
      />
    </Box>
  );
};
