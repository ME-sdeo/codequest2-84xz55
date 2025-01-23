import React, { memo, useMemo, useCallback } from 'react'; // react v18.0+
import { Typography, Box, Tooltip, useMediaQuery, useTheme } from '@mui/material'; // @mui/material v5.0+
import { TrendingUp, TrendingDown } from '@mui/icons-material'; // @mui/icons-material v5.0+
import { Sparklines, SparklinesLine } from 'react-sparklines'; // react-sparklines v1.7.0
import Card from '../common/Card';
import { MetricType, MetricValue } from '../../types/analytics.types';

interface MetricsCardProps {
  metric: MetricValue;
  title: string;
  description?: string;
  className?: string;
  onClick?: (metric: MetricValue) => void;
  ariaLabel?: string;
}

const formatMetricValue = (metric: MetricValue, locale: string = 'en-US'): string => {
  const formatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  switch (metric.type) {
    case MetricType.AI_DETECTION_RATE:
      return `${formatter.format(metric.value)}%`;
    case MetricType.AVERAGE_POINTS:
      return formatter.format(metric.value);
    case MetricType.TOTAL_POINTS:
      return formatter.format(Math.round(metric.value));
    case MetricType.ACTIVITY_COUNT:
      return formatter.format(Math.round(metric.value));
    default:
      return formatter.format(metric.value);
  }
};

const MetricsCard = memo<MetricsCardProps>(({
  metric,
  title,
  description,
  className,
  onClick,
  ariaLabel,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const formattedValue = useMemo(() => formatMetricValue(metric), [metric]);
  const isPositiveChange = metric.change >= 0;

  const trendColor = useMemo(() => {
    return isPositiveChange ? theme.palette.success.main : theme.palette.error.main;
  }, [isPositiveChange, theme.palette]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick(metric);
    }
  }, [onClick, metric]);

  const formattedChange = useMemo(() => {
    const changeValue = Math.abs(metric.change);
    return `${changeValue.toFixed(1)}%`;
  }, [metric.change]);

  return (
    <Card
      className={className}
      elevated={true}
      interactive={!!onClick}
      onClick={onClick ? () => onClick(metric) : undefined}
      onKeyPress={handleKeyPress}
      role="article"
      ariaLabel={ariaLabel || `${title} metric card`}
    >
      <Box sx={{ p: 2 }}>
        <Typography
          variant="subtitle2"
          color="textSecondary"
          gutterBottom
        >
          {title}
        </Typography>

        <Typography
          variant="h4"
          sx={{
            fontSize: 'clamp(20px, 2vw, 24px)',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: 'text.primary'
          }}
        >
          {formattedValue}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: trendColor,
            bgcolor: `${trendColor}14`,
            borderRadius: '4px',
            px: 1,
            py: 0.5,
            width: 'fit-content'
          }}
        >
          <Tooltip title={`${isPositiveChange ? 'Increase' : 'Decrease'} from previous period`}>
            <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
              {isPositiveChange ? <TrendingUp fontSize="small" /> : <TrendingDown fontSize="small" />}
              <Typography
                variant="body2"
                component="span"
                sx={{ ml: 0.5, fontWeight: 'medium' }}
              >
                {formattedChange}
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        {description && (
          <Typography
            variant="body2"
            color="textSecondary"
            sx={{ mt: 1 }}
          >
            {description}
          </Typography>
        )}

        {metric.trend && metric.trend.length > 0 && (
          <Box
            sx={{
              height: 'clamp(24px, 3vw, 32px)',
              mt: 2,
              transition: 'height 0.2s ease'
            }}
          >
            <Sparklines
              data={metric.trend}
              width={isMobile ? 100 : 200}
              height={isMobile ? 24 : 32}
              margin={5}
            >
              <SparklinesLine
                color={trendColor}
                style={{ strokeWidth: 2, fill: 'none' }}
              />
            </Sparklines>
          </Box>
        )}
      </Box>
    </Card>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;