import {
  Card,
  CardContent,
  Grid,
  Typography,
  makeStyles,
} from '@material-ui/core';
import type { JobStatistics } from '../../types';

const useStyles = makeStyles(theme => ({
  statCard: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: theme.spacing(2),
  },
  statValue: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    marginTop: theme.spacing(1),
  },
  statLabel: {
    color: theme.palette.text.secondary,
    fontSize: '0.875rem',
  },
  totalCard: {
    borderLeft: `4px solid ${theme.palette.info.main}`,
  },
  runningCard: {
    borderLeft: `4px solid ${theme.palette.warning.main}`,
  },
  completedCard: {
    borderLeft: `4px solid ${theme.palette.success.main}`,
  },
  failedCard: {
    borderLeft: `4px solid ${theme.palette.error.main}`,
  },
}));

interface StatisticsCardProps {
  statistics: JobStatistics;
}

export const StatisticsCard = ({ statistics }: StatisticsCardProps) => {
  const classes = useStyles();

  const stats = [
    {
      label: 'Total Jobs',
      value: statistics.totalJobs,
      className: classes.totalCard,
    },
    {
      label: 'Running',
      value: statistics.runningJobs,
      className: classes.runningCard,
    },
    {
      label: 'Completed',
      value: statistics.completedJobs,
      className: classes.completedCard,
    },
    {
      label: 'Failed',
      value: statistics.failedJobs,
      className: classes.failedCard,
    },
  ];

  return (
    <Grid container spacing={3}>
      {stats.map((stat, index) => (
        <Grid item xs={12} sm={6} md={3} key={index}>
          <Card className={`${classes.statCard} ${stat.className}`}>
            <CardContent>
              <Typography className={classes.statLabel} variant="body2">
                {stat.label}
              </Typography>
              <Typography className={classes.statValue} variant="h3">
                {stat.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};
