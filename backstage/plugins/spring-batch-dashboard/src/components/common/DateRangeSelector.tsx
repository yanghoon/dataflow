import React from 'react';
import { Box, Button, ButtonGroup, Grid, TextField } from '@mui/material';

export type QuickDateRange = 'today' | 'yesterday' | 'last7days' | 'last30days';

interface DateRangeSelectorProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  onQuickSelect?: (range: QuickDateRange) => void;
}

export const DateRangeSelector = ({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onQuickSelect,
}: DateRangeSelectorProps) => {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const last7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const last30 = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .split('T')[0];

  const handleQuickSelect = (range: QuickDateRange) => {
    if (onQuickSelect) {
      onQuickSelect(range);
    } else {
      // Default implementation
      switch (range) {
        case 'today':
          onFromDateChange(today);
          onToDateChange(today);
          break;
        case 'yesterday':
          onFromDateChange(yesterday);
          onToDateChange(yesterday);
          break;
        case 'last7days':
          onFromDateChange(last7);
          onToDateChange(today);
          break;
        case 'last30days':
          onFromDateChange(last30);
          onToDateChange(today);
          break;
      }
    }
  };

  const isActiveRange = (range: QuickDateRange): boolean => {
    switch (range) {
      case 'today':
        return fromDate === today && toDate === today;
      case 'yesterday':
        return fromDate === yesterday && toDate === yesterday;
      case 'last7days':
        return fromDate === last7 && toDate === today;
      case 'last30days':
        return fromDate === last30 && toDate === today;
      default:
        return false;
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <ButtonGroup variant="outlined" size="small">
            <Button
              onClick={() => handleQuickSelect('today')}
              variant={isActiveRange('today') ? 'contained' : 'outlined'}
              color={isActiveRange('today') ? 'primary' : 'inherit'}
            >
              Today
            </Button>
            <Button
              onClick={() => handleQuickSelect('yesterday')}
              variant={isActiveRange('yesterday') ? 'contained' : 'outlined'}
              color={isActiveRange('yesterday') ? 'primary' : 'inherit'}
            >
              Yesterday
            </Button>
            <Button
              onClick={() => handleQuickSelect('last7days')}
              variant={isActiveRange('last7days') ? 'contained' : 'outlined'}
              color={isActiveRange('last7days') ? 'primary' : 'inherit'}
            >
              Last 7 Days
            </Button>
            <Button
              onClick={() => handleQuickSelect('last30days')}
              variant={isActiveRange('last30days') ? 'contained' : 'outlined'}
              color={isActiveRange('last30days') ? 'primary' : 'inherit'}
            >
              Last 30 Days
            </Button>
          </ButtonGroup>
        </Grid>
        <Grid item>
          <TextField
            label="From Date"
            type="date"
            value={fromDate}
            onChange={e => onFromDateChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            variant="outlined"
            size="small"
          />
        </Grid>
        <Grid item>
          <TextField
            label="To Date"
            type="date"
            value={toDate}
            onChange={e => onToDateChange(e.target.value)}
            InputLabelProps={{ shrink: true }}
            variant="outlined"
            size="small"
          />
        </Grid>
      </Grid>
    </Box>
  );
};
