import React from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material';
import { SELECT_MENU_PROPS } from '../../utils';

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | string[];
  minWidth?: number;
  showAll?: boolean;
}

export const FilterSelect = ({
  label,
  value,
  onChange,
  options,
  minWidth = 200,
  showAll = true,
}: FilterSelectProps) => {
  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value);
  };

  return (
    <FormControl sx={{ minWidth }}>
      <InputLabel shrink>{label}</InputLabel>
      <Select
        value={value}
        onChange={handleChange}
        MenuProps={SELECT_MENU_PROPS}
        displayEmpty
        notched
      >
        {showAll && <MenuItem value="">All</MenuItem>}
        {options.map(option => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};
