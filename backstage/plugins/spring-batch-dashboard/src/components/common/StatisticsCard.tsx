import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { getStatBorderColor } from '../../utils';

interface StatisticsCardProps {
  value: number | string;
  label: string;
  type?:
    | 'total'
    | 'completed'
    | 'failed'
    | 'running'
    | 'primary'
    | 'info'
    | 'secondary'
    | 'default';
  textType?: 'total' | 'completed' | 'failed' | 'running' | 'default';
}

const semanticTextColor = (type: string): string => {
  switch (type) {
    case 'completed':
      return 'success.main';
    case 'failed':
      return 'error.main';
    case 'running':
      return 'info.main';
    default:
      return 'text.primary';
  }
};

export const StatisticsCard = ({
  value,
  label,
  type = 'total',
  textType = 'default',
}: StatisticsCardProps) => {
  const borderType:
    | 'total'
    | 'completed'
    | 'failed'
    | 'running'
    | 'primary'
    | 'info'
    | 'secondary' = type === 'default' ? 'total' : type;
  const borderColor = getStatBorderColor(borderType);

  const resolvedTextType = textType !== 'default' ? textType : (type as string);
  const textColor = semanticTextColor(resolvedTextType);

  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid',
        borderColor: 'divider',
        borderTop: '4px solid',
        borderTopColor: borderColor,
      }}
    >
      <CardContent
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Typography
          sx={{
            fontSize: '2rem',
            fontWeight: 700,
            mb: 1,
            color: textColor,
            textAlign: 'center',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            textTransform: 'uppercase',
            fontSize: '0.875rem',
            letterSpacing: '0.5px',
            textAlign: 'center',
          }}
        >
          {label}
        </Typography>
      </CardContent>
    </Card>
  );
};
