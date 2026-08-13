import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ZoomIn, ZoomOut, Maximize2, Minimize2, Move, Sparkles, 
  TrendingUp, TrendingDown, RefreshCw, Flame, Info, ChevronRight, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, Bill, UnbilledEntry } from '../types';
import { ThemeVisualEffects } from './ThemeVisualEffects';
import { calculateBillProfit, parseTimestamp } from '../lib/utils';

interface PremiumInteractiveChartProps {
  state: AppState;
  timePeriod: 'today' | 'week' | 'month' | 'year' | 'all';
  currentBills: Bill[];
  currentUnbilled?: UnbilledEntry[];
  themeChartColors: any;
}

export interface DataPoint {
  label: string;
  fullLabel: string;
  sales: number;
  profit: number;
  bills: number;
  timestamp: string;
}

// Helper to calculate profit of a single bill
const getBillProfit = (bill: Bill, itemsCatalog?: any[]) => {
  return calculateBillProfit(bill, itemsCatalog);
};

// Generates highly realistic and stylish demo data when no transactions occur
const getSimulatedData = (period: 'today' | 'week' | 'month' | 'year' | 'all'): DataPoint[] => {
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  
  if (period === 'today') {
    return Array.from({ length: 24 }, (_, h) => {
      const isPostMeridiem = h >= 12;
      const formattedHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const hourStr = `${formattedHour} ${isPostMeridiem ? 'PM' : 'AM'}`;
      
      // Typical retail traffic curve: peak in afternoon/evening
      let sales = 350 + Math.random() * 250;
      if (h >= 16 && h <= 18) { // Peak 4 PM - 6 PM
        sales += 8200 + Math.random() * 3500;
      } else if (h >= 12 && h < 16) { // Midday rush
        sales += 4200 + Math.random() * 2000;
      } else if (h >= 19 && h <= 21) { // Late night checkout
        sales += 5100 + Math.random() * 1900;
      } else if (h < 8) { // Midnight to morning
        sales = h < 6 ? 0 : 200 + Math.random() * 150;
      }
      const profit = sales * (0.22 + Math.random() * 0.12);
      return {
        label: hourStr,
        fullLabel: `Today at ${hourStr} (Demonstration Data)`,
        sales: Math.round(sales),
        profit: Math.round(profit),
        bills: sales > 0 ? Math.ceil(sales / (300 + Math.random() * 200)) : 0,
        timestamp: new Date(new Date().setHours(h, 0, 0, 0)).toISOString()
      };
    });
  } else if (period === 'week') {
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return dayNames.map((day, idx) => {
      let multiplier = 1.0;
      if (idx === 4) multiplier = 2.45; // Friday is highest revenue day!
      else if (idx === 5) multiplier = 1.95; // Saturday
      else if (idx === 6) multiplier = 1.45; // Sunday
      else multiplier = 0.85 + Math.random() * 0.35;

      const sales = Math.round((9500 + Math.random() * 4000) * multiplier);
      const profit = Math.round(sales * (0.23 + Math.random() * 0.1));
      return {
        label: day,
        fullLabel: `${day}day Performance (Demonstration Data)`,
        sales,
        profit,
        bills: Math.ceil(sales / 520),
        timestamp: new Date(Date.now() - (6 - idx) * 24 * 3600 * 1000).toISOString()
      };
    });
  } else if (period === 'month') {
    const days = new Date(year, monthIdx + 1, 0).getDate();
    const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from({ length: days }, (_, i) => {
      const dateNum = i + 1;
      const isWeekend = (dateNum - 1) % 7 === 4 || (dateNum - 1) % 7 === 5;
      const base = isWeekend ? 11800 : 5800;
      const sales = Math.round(base + Math.random() * 4500);
      const profit = Math.round(sales * (0.24 + Math.random() * 0.08));
      return {
        label: `${dateNum}`,
        fullLabel: `${mNames[monthIdx]} ${dateNum}, ${year} (Demonstration Data)`,
        sales,
        profit,
        bills: Math.ceil(sales / 460),
        timestamp: new Date(year, monthIdx, dateNum).toISOString()
      };
    });
  } else {
    const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return mNames.map((m, idx) => {
      let base = 140000;
      if (idx === 11 || idx === 0) base = 260000; // Holiday seasons
      else if (idx === 5 || idx === 6) base = 195000; // Summer bump
      const sales = Math.round(base + Math.random() * 65000);
      const profit = Math.round(sales * (0.24 + Math.random() * 0.06));
      return {
        label: m,
        fullLabel: `${m} ${year} Business Review (Demonstration Data)`,
        sales,
        profit,
        bills: Math.ceil(sales / 480),
        timestamp: new Date(year, idx, 1).toISOString()
      };
    });
  }
};

// Generates smooth Bezier curve splines in SVG format
function getBezierCurvePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    
    // Control points: 1/3 and 2/3 distance horizontally, matching vertical trends
    const cp1x = curr.x + (next.x - curr.x) / 3;
    const cp1y = curr.y;
    const cp2x = curr.x + (2 * (next.x - curr.x)) / 3;
    const cp2y = next.y;
    
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${next.x} ${next.y}`;
  }
  return path;
}

export default function PremiumInteractiveChart({ 
  state, 
  timePeriod, 
  currentBills,
  currentUnbilled = [],
  themeChartColors 
}: PremiumInteractiveChartProps) {
  const [dataMode, setDataMode] = useState<'live' | 'demo'>('live');
  const [chartType, setChartType] = useState<'line' | 'column'>('line');
  const [zoomScale, setZoomScale] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [heightMode, setHeightMode] = useState<'standard' | 'tall' | 'ultra'>('tall');
  const [layoutMode, setLayoutMode] = useState<'fit' | 'panorama'>('fit');

  // Auto-adapt layout mode based on time period density density
  useEffect(() => {
    if (timePeriod === 'month' || timePeriod === 'today') {
      setLayoutMode('panorama');
    } else {
      setLayoutMode('fit');
    }
  }, [timePeriod]);

  // Drag interaction refs
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragStartRef = useRef({ x: 0, pan: 0 });
  
  // Touch gestures info
  const touchStartDist = useRef<number | null>(null);
  const touchStartScale = useRef(1);

  // Auto fallback logic if live data is empty
  const hasLiveBills = currentBills.length > 0 || currentUnbilled.length > 0;
  useEffect(() => {
    if (!hasLiveBills) {
      setDataMode('demo');
    } else {
      setDataMode('live');
    }
  }, [hasLiveBills, timePeriod]);

  // Reset zoom configuration when timePeriod or fullscreen flag changes
  useEffect(() => {
    setZoomScale(1);
    setPanOffset(0);
    setHoverIndex(null);
  }, [timePeriod, isFullscreen]);

  // Translate bills and unbilled micro-sales entries to proper time-indexed buckets
  const realChartData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const monthIdx = now.getMonth();

    if (timePeriod === 'today') {
      const buckets: DataPoint[] = Array.from({ length: 24 }, (_, h) => {
        const isPostMeridiem = h >= 12;
        const formattedHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const hourStr = `${formattedHour} ${isPostMeridiem ? 'PM' : 'AM'}`;
        return {
          label: hourStr,
          fullLabel: `Today at ${hourStr}`,
          sales: 0,
          profit: 0,
          bills: 0,
          timestamp: new Date(new Date().setHours(h, 0, 0, 0)).toISOString()
        };
      });

      currentBills.forEach(bill => {
        const d = parseTimestamp(bill.timestamp);
        const hour = d.getHours();
        if (hour >= 0 && hour < 24) {
          buckets[hour].sales += Number(bill.total) || 0;
          buckets[hour].profit += getBillProfit(bill, state.items);
          buckets[hour].bills += 1;
        }
      });

      currentUnbilled.forEach(entry => {
        const d = parseTimestamp(entry.timestamp || entry.dateStr);
        const hour = d.getHours();
        if (hour >= 0 && hour < 24) {
          const amt = Number(entry.amount) || 0;
          buckets[hour].sales += amt;
          buckets[hour].profit += amt;
          buckets[hour].bills += 1;
        }
      });

      return buckets;
    } else if (timePeriod === 'week') {
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const buckets: DataPoint[] = dayNames.map((day, idx) => ({
        label: day,
        fullLabel: `${day}day Performance`,
        sales: 0,
        profit: 0,
        bills: 0,
        timestamp: new Date(Date.now() - (6 - idx) * 24 * 3600 * 1050).toISOString()
      }));

      currentBills.forEach(bill => {
        const d = parseTimestamp(bill.timestamp);
        let dayIndex = d.getDay() - 1; // getDay(): 0 = Sun
        if (dayIndex === -1) dayIndex = 6; // Sun
        if (dayIndex >= 0 && dayIndex < 7) {
          buckets[dayIndex].sales += Number(bill.total) || 0;
          buckets[dayIndex].profit += getBillProfit(bill, state.items);
          buckets[dayIndex].bills += 1;
        }
      });

      currentUnbilled.forEach(entry => {
        const d = parseTimestamp(entry.timestamp || entry.dateStr);
        let dayIndex = d.getDay() - 1;
        if (dayIndex === -1) dayIndex = 6;
        if (dayIndex >= 0 && dayIndex < 7) {
          const amt = Number(entry.amount) || 0;
          buckets[dayIndex].sales += amt;
          buckets[dayIndex].profit += amt;
          buckets[dayIndex].bills += 1;
        }
      });

      return buckets;
    } else if (timePeriod === 'month') {
      const days = new Date(year, monthIdx + 1, 0).getDate();
      const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const buckets: DataPoint[] = Array.from({ length: days }, (_, i) => ({
        label: `${i + 1}`,
        fullLabel: `${mNames[monthIdx]} ${i + 1}, ${year}`,
        sales: 0,
        profit: 0,
        bills: 0,
        timestamp: new Date(year, monthIdx, i + 1).toISOString()
      }));

      currentBills.forEach(bill => {
        const d = parseTimestamp(bill.timestamp);
        if (d.getFullYear() === year && d.getMonth() === monthIdx) {
          const dateNum = d.getDate();
          if (dateNum >= 1 && dateNum <= days) {
            buckets[dateNum - 1].sales += Number(bill.total) || 0;
            buckets[dateNum - 1].profit += getBillProfit(bill, state.items);
            buckets[dateNum - 1].bills += 1;
          }
        }
      });

      currentUnbilled.forEach(entry => {
        const d = parseTimestamp(entry.timestamp || entry.dateStr);
        if (d.getFullYear() === year && d.getMonth() === monthIdx) {
          const dateNum = d.getDate();
          if (dateNum >= 1 && dateNum <= days) {
            const amt = Number(entry.amount) || 0;
            buckets[dateNum - 1].sales += amt;
            buckets[dateNum - 1].profit += amt;
            buckets[dateNum - 1].bills += 1;
          }
        }
      });

      return buckets;
    } else {
      const mNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const buckets: DataPoint[] = mNames.map((m, idx) => ({
        label: m,
        fullLabel: `${m} ${year} Business Review`,
        sales: 0,
        profit: 0,
        bills: 0,
        timestamp: new Date(year, idx, 1).toISOString()
      }));

      currentBills.forEach(bill => {
        const d = parseTimestamp(bill.timestamp);
        const mIdx = d.getMonth();
        if (mIdx >= 0 && mIdx < 12) {
          if (timePeriod === 'all' || d.getFullYear() === year) {
            buckets[mIdx].sales += Number(bill.total) || 0;
            buckets[mIdx].profit += getBillProfit(bill, state.items);
            buckets[mIdx].bills += 1;
          }
        }
      });

      currentUnbilled.forEach(entry => {
        const d = parseTimestamp(entry.timestamp || entry.dateStr);
        const mIdx = d.getMonth();
        if (mIdx >= 0 && mIdx < 12) {
          if (timePeriod === 'all' || d.getFullYear() === year) {
            const amt = Number(entry.amount) || 0;
            buckets[mIdx].sales += amt;
            buckets[mIdx].profit += amt;
            buckets[mIdx].bills += 1;
          }
        }
      });

      return buckets;
    }
  }, [currentBills, currentUnbilled, timePeriod, state.items]);

  // Pick active dataset based on state toggle
  const activeDataset = useMemo(() => {
    if (dataMode === 'demo') {
      return getSimulatedData(timePeriod);
    }
    return realChartData;
  }, [dataMode, realChartData, timePeriod]);

  // Compute Peak/Low indices for auto annotations
  const annotations = useMemo(() => {
    let maxSalesIdx = -1, minSalesIdx = -1;
    let maxProfitIdx = -1, minProfitIdx = -1;
    let maxSales = -Infinity, minSales = Infinity;
    let maxProfit = -Infinity, minProfit = Infinity;

    activeDataset.forEach((pt, idx) => {
      // Find Max Sales
      if (pt.sales > maxSales) {
        maxSales = pt.sales;
        maxSalesIdx = idx;
      }
      // Find Min Sales (ignoring 0 if possible, otherwise accept)
      if (pt.sales < minSales && pt.sales > 0) {
        minSales = pt.sales;
        minSalesIdx = idx;
      }
      // Find Max Profit
      if (pt.profit > maxProfit) {
        maxProfit = pt.profit;
        maxProfitIdx = idx;
      }
      // Find Min Profit
      if (pt.profit < minProfit && pt.profit > 0) {
        minProfit = pt.profit;
        minProfitIdx = idx;
      }
    });

    // Make sure we have fallbacks if nothing is non-zero
    if (minSalesIdx === -1) minSalesIdx = 0;
    if (minProfitIdx === -1) minProfitIdx = 0;

    return { maxSalesIdx, minSalesIdx, maxProfitIdx, minProfitIdx };
  }, [activeDataset]);

  // Core metrics calculated based on data selection
  const aggregatedValues = useMemo(() => {
    let totalSales = 0;
    let totalProfit = 0;
    let avgBasketValue = 0;
    let totalBillsCount = 0;

    activeDataset.forEach(pt => {
      totalSales += pt.sales;
      totalProfit += pt.profit;
      totalBillsCount += pt.bills;
    });

    avgBasketValue = totalBillsCount > 0 ? (totalSales / totalBillsCount) : 0;
    const margin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;

    // Identify Peak Day/Time period
    const sortedBySales = [...activeDataset].sort((a, b) => b.sales - a.sales);
    const peakIntervalLabel = sortedBySales[0]?.label || 'N/A';

    return {
      totalSales,
      totalProfit,
      avgBasketValue,
      totalBillsCount,
      margin,
      peakIntervalLabel
    };
  }, [activeDataset]);

  // Render specifications inside virtual coordinate space
  const svgWidth = 1000;
  const svgHeight = isFullscreen 
    ? 680 
    : heightMode === 'ultra' 
      ? 580 
      : heightMode === 'tall' 
        ? 480 
        : 385;
  const paddingLeft = 105;
  const paddingRight = 45;
  const paddingTop = 60;
  const paddingBottom = 60;

  const drawableWidth = svgWidth - paddingLeft - paddingRight;
  const drawableHeight = svgHeight - paddingTop - paddingBottom;

  // Compute scale boundaries for coordinates
  const maxDataVal = useMemo(() => {
    let largest = 2000;
    activeDataset.forEach(pt => {
      if (pt.sales > largest) largest = pt.sales;
      if (pt.profit > largest) largest = pt.profit;
    });
    return largest * 1.15; // 15% clear top margin
  }, [activeDataset]);

  // Scale data-index onto coordinate space
  const getCoordinates = (index: number, salesVal: number, profitVal: number) => {
    const totalPoints = activeDataset.length;
    // Calculate index spacing in virtual horizontal window
    const scaleWidth = drawableWidth * zoomScale;
    const spacing = totalPoints > 1 ? scaleWidth / (totalPoints - 1) : scaleWidth;
    
    // Virtual X with spacing and panOffset offset
    const xVirtual = paddingLeft + index * spacing + panOffset;
    
    const ySales = paddingTop + drawableHeight - (salesVal / maxDataVal) * drawableHeight;
    const yProfit = paddingTop + drawableHeight - (profitVal / maxDataVal) * drawableHeight;

    return { x: xVirtual, ySales, yProfit };
  };

  // Precompile point coordinates for rapid drafting
  const coordPoints = useMemo(() => {
    return activeDataset.map((pt, idx) => {
      const { x, ySales, yProfit } = getCoordinates(idx, pt.sales, pt.profit);
      return { x, ySales, yProfit, original: pt };
    });
  }, [activeDataset, zoomScale, panOffset, maxDataVal, drawableWidth, drawableHeight]);

  // Generate paths for standard viewport drawing
  const salesLinesPath = useMemo(() => {
    const points = coordPoints.map(p => ({ x: p.x, y: p.ySales }));
    return getBezierCurvePath(points);
  }, [coordPoints]);

  const profitLinesPath = useMemo(() => {
    const points = coordPoints.map(p => ({ x: p.x, y: p.yProfit }));
    return getBezierCurvePath(points);
  }, [coordPoints]);

  const salesFillPath = useMemo(() => {
    if (coordPoints.length === 0) return '';
    const bottomLineY = paddingTop + drawableHeight;
    return `${salesLinesPath} L ${coordPoints[coordPoints.length - 1].x} ${bottomLineY} L ${coordPoints[0].x} ${bottomLineY} Z`;
  }, [coordPoints, salesLinesPath]);

  const profitFillPath = useMemo(() => {
    if (coordPoints.length === 0) return '';
    const bottomLineY = paddingTop + drawableHeight;
    return `${profitLinesPath} L ${coordPoints[coordPoints.length - 1].x} ${bottomLineY} L ${coordPoints[0].x} ${bottomLineY} Z`;
  }, [coordPoints, profitLinesPath]);

  // Click & touch event handlers for panning inside boundary limits
  const minPan = drawableWidth - drawableWidth * zoomScale;
  const maxPan = 0;

  const handlePointerDown = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const isTouchEvent = 'touches' in e;
    
    if (isTouchEvent && e.touches.length === 2) {
      // Pinch to Zoom start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchStartDist.current = dist;
      touchStartScale.current = zoomScale;
      return;
    }

    const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
    setIsPanning(true);
    dragStartRef.current = { x: clientX, pan: panOffset };
  };

  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const isTouchEvent = 'touches' in e;
    
    // Pinch gesture checking
    if (isTouchEvent && e.touches.length === 2 && touchStartDist.current !== null) {
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      
      const rawScale = touchStartScale.current * (dist / touchStartDist.current);
      const nextScale = Math.max(1, Math.min(5, parseFloat(rawScale.toFixed(2))));
      
      setZoomScale(nextScale);
      return;
    }

    // Hover or Drag panning logic
    const clientX = isTouchEvent ? e.touches[0].clientX : e.clientX;
    const rect = svgRef.current?.getBoundingClientRect();
    
    if (rect) {
      const scaleFactorX = svgWidth / rect.width;
      const xCoordRelative = (clientX - rect.left) * scaleFactorX;

      // Update hover highlights state
      let closestIdx = -1;
      let minDistance = Infinity;

      coordPoints.forEach((pt, idx) => {
        // Find absolute horizontal spacing distance
        const dist = Math.abs(pt.x - xCoordRelative);
        if (dist < minDistance) {
          minDistance = dist;
          closestIdx = idx;
        }
      });

      // Strict limit threshold check to avoid selecting points far out of range
      if (minDistance < (drawableWidth * zoomScale) / (activeDataset.length || 1) * 0.8) {
        setHoverIndex(closestIdx);
      } else {
        setHoverIndex(null);
      }
    }

    if (!isPanning) return;
    
    e.preventDefault();
    const deltaX = clientX - dragStartRef.current.x;
    const nextPan = dragStartRef.current.pan + deltaX * (svgWidth / (rect?.width || 1));
    
    // Clamp panning offsets strictly
    setPanOffset(Math.max(minPan, Math.min(maxPan, nextPan)));
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    touchStartDist.current = null;
  };

  // Zoom manipulation controllers
  const triggerZoom = (direction: 'in' | 'out') => {
    let nextScale = zoomScale;
    if (direction === 'in') {
      nextScale = Math.min(5, zoomScale + 0.5);
    } else {
      nextScale = Math.max(1, zoomScale - 0.5);
    }

    setZoomScale(nextScale);
    
    // Automatically clamp panning offset based on new parameters
    const nextMinPan = drawableWidth - drawableWidth * nextScale;
    setPanOffset(prev => Math.max(nextMinPan, Math.min(maxPan, prev)));
  };

  const triggerZoomReset = () => {
    setZoomScale(1);
    setPanOffset(0);
    setHoverIndex(null);
  };

  // Handle manual mouse scroll zoom interaction inside region bounds
  const handleScrollWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (Math.abs(e.deltaY) > 0) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 0.15 : -0.15;
      const nextScale = Math.max(1, Math.min(5, zoomScale + zoomFactor));
      
      setZoomScale(nextScale);
      
      const nextMinPan = drawableWidth - drawableWidth * nextScale;
      setPanOffset(prev => Math.max(nextMinPan, Math.min(maxPan, prev)));
    }
  };

  // Dynamic Horizontal Grid division levels
  const yGridLinesCount = 5;
  const grids = Array.from({ length: yGridLinesCount }, (_, idx) => {
    const fraction = idx / (yGridLinesCount - 1);
    const value = maxDataVal * fraction;
    const y = paddingTop + drawableHeight - fraction * drawableHeight;
    return { y, value };
  });

  // Theme support config checks to preserve readable grids and high readability contrast
  const chartSalesStroke = themeChartColors.sales?.stroke || '#3b82f6';
  const chartProfitStroke = themeChartColors.profit?.stroke || '#10b981';

  return (
    <div 
      className={`relative rounded-[2.5rem] flex flex-col justify-between transition-all duration-300 shadow-2xl p-6 md:p-8 select-none border border-[var(--border)] overflow-visible ${
        isFullscreen 
          ? 'fixed inset-0 z-50 bg-[#060a13] text-slate-100 overflow-y-auto w-screen h-screen' 
          : 'bg-[var(--card)]'
      }`}
    >
      <ThemeVisualEffects theme={state.settings.theme} disableMovement={true} />
      {/* Background ambient light effects */}
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[var(--primary)]/5 to-transparent blur-3xl pointer-events-none rounded-[2.5rem]" />
      
      {/* Visual Header indicators */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between border-b border-[var(--border)] pb-5 z-10 gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--primary)] animate-ping shrink-0" />
            <span className="text-[10px] uppercase tracking-[0.3em] font-black opacity-60">Corporate Intelligence Portal</span>
          </div>
          <h3 className="text-xl md:text-2xl font-black tracking-tight text-[var(--foreground)] uppercase mt-1">
            Revenues & Profit <span className="text-[var(--primary)] font-extrabold">Spectrum</span>
          </h3>
          <p className="text-[10px] leading-relaxed text-[var(--foreground)]/50 uppercase tracking-widest font-bold">
            Interactive, zooming visualizer mapping sales trends against margins
          </p>

          {/* Fully Legible Chart Legend & Aggregated Values */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-2 border-t border-[var(--border)]/40">
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: chartSalesStroke }} />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider opacity-60 font-black">Sales Trend</span>
                <span className="text-sm font-extrabold font-mono text-[var(--foreground)]">
                  ₹{aggregatedValues.totalSales.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: chartProfitStroke }} />
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider opacity-60 font-black">Net Profit</span>
                <span className="text-sm font-extrabold font-mono text-emerald-500">
                  ₹{aggregatedValues.totalProfit.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider opacity-60 font-black">Average Margin</span>
                <span className="text-sm font-extrabold font-mono text-amber-500">
                  {aggregatedValues.margin.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Action button rails */}
        <div className="flex flex-wrap items-center gap-3 z-20">
          {/* Chart Style choice toggle */}
          <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-950/40 backdrop-blur p-0.5 rounded-xl border border-[var(--border)] shadow-xs">
            <span className="text-[9.5px] font-black uppercase text-[var(--foreground)]/60 px-2.5 tracking-wider hidden sm:inline">Chart Style:</span>
            <button 
              onClick={() => setChartType('line')}
              className={`px-3 py-1.5 rounded-lg text-[9.5px] uppercase font-black tracking-wider transition-all duration-150 cursor-pointer ${
                chartType === 'line' 
                  ? 'bg-[var(--primary)] text-white dark:text-white shadow-sm font-black' 
                  : 'text-[var(--foreground)]/60 dark:text-[var(--foreground)]/65 hover:text-[var(--foreground)] dark:hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.04] dark:hover:bg-[var(--foreground)]/[0.08]'
              }`}
            >
              Line Chart
            </button>
            <button 
              onClick={() => setChartType('column')}
              className={`px-3 py-1.5 rounded-lg text-[9.5px] uppercase font-black tracking-wider transition-all duration-150 cursor-pointer ${
                chartType === 'column' 
                  ? 'bg-[var(--primary)] text-white dark:text-white shadow-sm font-black' 
                  : 'text-[var(--foreground)]/60 dark:text-[var(--foreground)]/65 hover:text-[var(--foreground)] dark:hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.04] dark:hover:bg-[var(--foreground)]/[0.08]'
              }`}
            >
              Column Chart
            </button>
          </div>

          {/* Layout presentation mode container controls */}
          <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-950/40 backdrop-blur p-0.5 rounded-xl border border-[var(--border)] shadow-xs">
            <span className="text-[9.5px] font-black uppercase text-[var(--foreground)]/60 px-2.5 tracking-wider hidden sm:inline">Presentation:</span>
            <button 
              onClick={() => setLayoutMode('fit')}
              className={`px-3 py-1.5 rounded-lg text-[9.5px] uppercase font-black tracking-wider transition-all duration-150 cursor-pointer ${
                layoutMode === 'fit' 
                  ? 'bg-[var(--primary)] text-white dark:text-white shadow-sm font-black' 
                  : 'text-[var(--foreground)]/60 dark:text-[var(--foreground)]/65 hover:text-[var(--foreground)] dark:hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.04] dark:hover:bg-[var(--foreground)]/[0.08]'
              }`}
            >
              Fit
            </button>
            <button 
              onClick={() => setLayoutMode('panorama')}
              className={`px-3 py-1.5 rounded-lg text-[9.5px] uppercase font-black tracking-wider transition-all duration-150 cursor-pointer ${
                layoutMode === 'panorama' 
                  ? 'bg-[var(--primary)] text-white dark:text-white shadow-sm font-black' 
                  : 'text-[var(--foreground)]/60 dark:text-[var(--foreground)]/65 hover:text-[var(--foreground)] dark:hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.04] dark:hover:bg-[var(--foreground)]/[0.08]'
              }`}
            >
              Panorama
            </button>
          </div>

          {/* Chart Height selector control for premium high legibility customization */}
          <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-950/40 backdrop-blur p-0.5 rounded-xl border border-[var(--border)] shadow-xs">
            <span className="text-[9.5px] font-black uppercase text-[var(--foreground)]/60 px-2.5 tracking-wider hidden sm:inline">Graph Height:</span>
            <button 
              onClick={() => setHeightMode('standard')}
              className={`px-3 py-1.5 rounded-lg text-[9.5px] uppercase font-black tracking-wider transition-all duration-150 cursor-pointer ${
                heightMode === 'standard' 
                  ? 'bg-[var(--primary)] text-white dark:text-white shadow-sm font-black' 
                  : 'text-[var(--foreground)]/60 dark:text-[var(--foreground)]/65 hover:text-[var(--foreground)] dark:hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.04] dark:hover:bg-[var(--foreground)]/[0.08]'
              }`}
            >
              Standard
            </button>
            <button 
              onClick={() => setHeightMode('tall')}
              className={`px-3 py-1.5 rounded-lg text-[9.5px] uppercase font-black tracking-wider transition-all duration-150 cursor-pointer ${
                heightMode === 'tall' 
                  ? 'bg-[var(--primary)] text-white dark:text-white shadow-sm font-black' 
                  : 'text-[var(--foreground)]/60 dark:text-[var(--foreground)]/65 hover:text-[var(--foreground)] dark:hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.04] dark:hover:bg-[var(--foreground)]/[0.08]'
              }`}
            >
              Tall
            </button>
            <button 
              onClick={() => setHeightMode('ultra')}
              className={`px-3 py-1.5 rounded-lg text-[9.5px] uppercase font-black tracking-wider transition-all duration-150 cursor-pointer ${
                heightMode === 'ultra' 
                  ? 'bg-[var(--primary)] text-white dark:text-white shadow-sm font-black' 
                  : 'text-[var(--foreground)]/60 dark:text-[var(--foreground)]/65 hover:text-[var(--foreground)] dark:hover:text-[var(--foreground)] hover:bg-[var(--foreground)]/[0.04] dark:hover:bg-[var(--foreground)]/[0.08]'
              }`}
            >
              Ultra Tall
            </button>
          </div>

          {/* Quick interactive zoom controls panel */}
          <div className="flex items-center bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur p-0.5 rounded-xl border border-[var(--border)] shadow-xs">
            <button 
              onClick={() => triggerZoom('in')}
              title="Zoom In"
              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-[var(--foreground)] transition cursor-pointer"
            >
              <ZoomIn size={14} />
            </button>
            <button 
              onClick={() => triggerZoom('out')}
              title="Zoom Out"
              className="p-1.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg text-[var(--foreground)] transition cursor-pointer"
              disabled={zoomScale === 1}
            >
              <ZoomOut size={14} className={zoomScale === 1 ? 'opacity-30' : ''} />
            </button>
            {(zoomScale > 1 || panOffset !== 0) && (
              <button 
                onClick={triggerZoomReset}
                title="Reset View"
                className="text-[9px] font-black uppercase px-2 py-1 bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-350 dark:hover:bg-zinc-700 text-[var(--foreground)] rounded-lg transition ml-1 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {/* Fullscreen Expand action */}
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur border border-[var(--border)] hover:bg-zinc-200 dark:hover:bg-zinc-800 text-[var(--foreground)] transition rounded-xl cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Focus Mode"}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
        </div>
      </div>

      {/* Primary SVG interactive graphics coordinate pane */}
      <div className="relative mt-6 z-10 w-full overflow-visible">
        {/* Swipe helper banner if scrollable panorama is selected */}
        {layoutMode === 'panorama' && (
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[10px] uppercase tracking-widest text-[var(--foreground)]/50 font-black">
              Time Axis Panorama View
            </span>
            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 font-extrabold px-2 py-0.5 rounded border border-indigo-500/15 uppercase tracking-wider animate-pulse flex items-center gap-1">
              <span>← Swipe sideways to navigate dates →</span>
            </span>
          </div>
        )}

        <div className="w-full overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-[rgba(255,255,255,0.15)] scrollbar-track-transparent">
          <div className="relative overflow-visible" style={{ width: layoutMode === 'panorama' ? '980px' : '100%' }}>
            {/* Helper Drag cursor notice if user zoomed */}
            {zoomScale > 1 && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-[var(--foreground)]/5 rounded-full border border-[var(--border)] text-[8.5px] font-bold uppercase tracking-widest text-[var(--foreground)]/70 pointer-events-none animate-pulse z-20">
                <Move size={10} />
                <span>Drag panning mode active (Scale: {zoomScale}x)</span>
              </div>
            )}

            <svg
              ref={svgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible cursor-crosshair select-none"
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
              onWheel={handleScrollWheel}
              style={{ touchAction: layoutMode === 'panorama' ? 'pan-x' : 'none' }}
            >
          {/* Custom SVG Gradient definitions */}
          <defs>
            <linearGradient id="gradientSales" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartSalesStroke} stopOpacity="0.32" />
              <stop offset="100%" stopColor={chartSalesStroke} stopOpacity="0.00" />
            </linearGradient>
            <linearGradient id="gradientProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartProfitStroke} stopOpacity="0.25" />
              <stop offset="100%" stopColor={chartProfitStroke} stopOpacity="0.00" />
            </linearGradient>
            
            {/* Premium Column Gradients */}
            <linearGradient id="barSalesGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartSalesStroke} stopOpacity="0.85" />
              <stop offset="100%" stopColor={chartSalesStroke} stopOpacity="0.15" />
            </linearGradient>
            <linearGradient id="barProfitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chartProfitStroke} stopOpacity="0.85" />
              <stop offset="100%" stopColor={chartProfitStroke} stopOpacity="0.15" />
            </linearGradient>

            {/* SVG glowing filters for path strokes */}
            <filter id="glowFilterSales" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor={chartSalesStroke} floodOpacity="0.45" />
            </filter>
            <filter id="glowFilterProfit" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor={chartProfitStroke} floodOpacity="0.35" />
            </filter>
          </defs>

          {/* Grids and backgrounds */}
          <g className="grid-lines">
            {grids.map((g, idx) => (
              <g key={idx}>
                {/* Horizontal gridline path */}
                <line 
                  x1={paddingLeft}
                  y1={g.y}
                  x2={svgWidth - paddingRight}
                  y2={g.y}
                  stroke="var(--foreground)"
                  strokeWidth="1.2"
                  className="opacity-[0.24] dark:opacity-[0.28]"
                  strokeDasharray="5,5"
                />
                {/* Currency grid labels */}
                <text
                  x={paddingLeft - 18}
                  y={g.y + 5}
                  textAnchor="end"
                  className="fill-[var(--foreground)] font-mono text-[12px] md:text-[13px] font-black opacity-95 uppercase tracking-wider"
                >
                  ₹{Math.round(g.value).toLocaleString()}
                </text>
              </g>
            ))}
          </g>

          {/* Column drawing structure */}
          {chartType === 'column' && (
            <g className="columns_area transition-all duration-300">
              {coordPoints.map((pt, idx) => {
                // Highly proportional column width calculation
                const colWidth = Math.max(4, Math.min(22, (svgWidth - paddingLeft - paddingRight) / activeDataset.length * 0.32));
                const salesHeight = Math.max(0, paddingTop + drawableHeight - pt.ySales);
                const profitHeight = Math.max(0, paddingTop + drawableHeight - pt.yProfit);
                const isHovered = hoverIndex === idx;
                const isDimmed = hoverIndex !== null && hoverIndex !== idx;

                return (
                  <g 
                    key={idx} 
                    className={`transition-all duration-200 cursor-pointer ${isDimmed ? 'opacity-[0.35]' : 'opacity-100'}`}
                    onMouseEnter={() => setHoverIndex(idx)}
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    {/* Sales Column (Rounded top rectangle) */}
                    {salesHeight > 0 && (
                      <rect
                        x={pt.x - colWidth - 1}
                        y={pt.ySales}
                        width={colWidth}
                        height={salesHeight}
                        fill="url(#barSalesGradient)"
                        stroke={chartSalesStroke}
                        strokeWidth="1.5"
                        rx="3.5"
                        ry="3.5"
                        className="transition-all duration-300"
                      />
                    )}

                    {/* Profit Column (Rounded top rectangle) */}
                    {profitHeight > 0 && (
                      <rect
                        x={pt.x + 1}
                        y={pt.yProfit}
                        width={colWidth}
                        height={profitHeight}
                        fill="url(#barProfitGradient)"
                        stroke={chartProfitStroke}
                        strokeWidth="1.5"
                        rx="3.5"
                        ry="3.5"
                        className="transition-all duration-300"
                      />
                    )}

                    {/* Highly aesthetic column alignment shadow overlay backer on hover */}
                    {isHovered && (
                      <rect
                        x={pt.x - colWidth - 6}
                        y={paddingTop - 10}
                        width={colWidth * 2 + 12}
                        height={drawableHeight + 20}
                        fill="var(--foreground)"
                        fillOpacity="0.04"
                        stroke="var(--foreground)"
                        strokeOpacity="0.1"
                        strokeWidth="1"
                        rx="8"
                        ry="8"
                        className="pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* Curve drawing structures */}
          {chartType === 'line' && (
            <g className="curves_area transition-all duration-300">
              {/* Sales gradient space */}
              <path
                d={salesFillPath}
                fill="url(#gradientSales)"
                className="transition-all duration-300"
              />
              {/* Profit gradient space */}
              <path
                d={profitFillPath}
                fill="url(#gradientProfit)"
                className="transition-all duration-300"
              />

              {/* Sales curve Line */}
              <path
                d={salesLinesPath}
                fill="none"
                stroke={chartSalesStroke}
                strokeWidth="4.2"
                strokeLinecap="round"
                filter="url(#glowFilterSales)"
                className="transition-all duration-300"
              />
              {/* Profit curve Line */}
              <path
                d={profitLinesPath}
                fill="none"
                stroke={chartProfitStroke}
                strokeWidth="3.2"
                strokeLinecap="round"
                filter="url(#glowFilterProfit)"
                className="transition-all duration-300"
              />
            </g>
          )}

          {/* Dynamic guideline and highlighted points */}
          {hoverIndex !== null && coordPoints[hoverIndex] && (
            <g className="interaction-indicators">
              {/* Vertical guideline */}
              <line
                x1={coordPoints[hoverIndex].x}
                y1={paddingTop - 15}
                x2={coordPoints[hoverIndex].x}
                y2={paddingTop + drawableHeight + 15}
                stroke="var(--primary)"
                strokeWidth="2"
                strokeDasharray="4,4"
                className="text-[var(--primary)] opacity-60 pointer-events-none"
              />

              {/* Horizontal Sales tracker guideline for extreme ease of reading */}
              <line
                x1={paddingLeft}
                y1={coordPoints[hoverIndex].ySales}
                x2={coordPoints[hoverIndex].x}
                y2={coordPoints[hoverIndex].ySales}
                stroke={chartSalesStroke}
                strokeWidth="1.2"
                strokeDasharray="3,3"
                className="opacity-40 pointer-events-none"
              />

              {/* Horizontal Profit tracker guideline */}
              <line
                x1={paddingLeft}
                y1={coordPoints[hoverIndex].yProfit}
                x2={coordPoints[hoverIndex].x}
                y2={coordPoints[hoverIndex].yProfit}
                stroke={chartProfitStroke}
                strokeWidth="1.2"
                strokeDasharray="3,3"
                className="opacity-40 pointer-events-none"
              />

              {/* Sales anchor dot */}
              <circle
                cx={coordPoints[hoverIndex].x}
                cy={coordPoints[hoverIndex].ySales}
                r="8.5"
                fill={chartSalesStroke}
                stroke="#fff"
                strokeWidth="2.5"
                className="shadow-2xl"
              />
              <circle
                cx={coordPoints[hoverIndex].x}
                cy={coordPoints[hoverIndex].ySales}
                r="18"
                fill={chartSalesStroke}
                className="opacity-25 animate-ping pointer-events-none"
              />

              {/* Profit anchor dot */}
              <circle
                cx={coordPoints[hoverIndex].x}
                cy={coordPoints[hoverIndex].yProfit}
                r="7.5"
                fill={chartProfitStroke}
                stroke="#fff"
                strokeWidth="2.2"
              />
              <circle
                cx={coordPoints[hoverIndex].x}
                cy={coordPoints[hoverIndex].yProfit}
                r="14"
                fill={chartProfitStroke}
                className="opacity-20 animate-ping pointer-events-none"
              />
            </g>
          )}

          {/* Auto peak milestones and annotations */}
          {coordPoints.length > 0 && (
            <g className="auto-highlights">
              {/* Peak Sales highlight */}
              {annotations.maxSalesIdx !== -1 && coordPoints[annotations.maxSalesIdx] && coordPoints[annotations.maxSalesIdx].original.sales > 0 && (
                <g>
                  {/* Subtle pulsing background ring */}
                  <circle 
                     cx={coordPoints[annotations.maxSalesIdx].x}
                     cy={coordPoints[annotations.maxSalesIdx].ySales}
                     r="14"
                     fill="none"
                     stroke={chartSalesStroke}
                     strokeWidth="1.2"
                     strokeDasharray="3,3"
                     className="opacity-70"
                  />
                  {/* Glowing text banner */}
                  <text
                    x={coordPoints[annotations.maxSalesIdx].x}
                    y={coordPoints[annotations.maxSalesIdx].ySales - 24}
                    textAnchor="middle"
                    className="fill-[var(--foreground)] font-black text-[10px] md:text-[11.5px] uppercase font-sans tracking-widest bg-black"
                  >
                    ★ PEAK SALES
                  </text>
                </g>
              )}

              {/* Peak Profit highlight */}
              {annotations.maxProfitIdx !== -1 && coordPoints[annotations.maxProfitIdx] && coordPoints[annotations.maxProfitIdx].original.profit > 0 && (
                <g>
                  <circle 
                    cx={coordPoints[annotations.maxProfitIdx].x}
                    cy={coordPoints[annotations.maxProfitIdx].yProfit}
                    r="12"
                    fill="none"
                    stroke={chartProfitStroke}
                    strokeWidth="1.2"
                    className="opacity-50"
                  />
                  <text
                    x={coordPoints[annotations.maxProfitIdx].x}
                    y={coordPoints[annotations.maxProfitIdx].yProfit + 26}
                    textAnchor="middle"
                    className="fill-emerald-400 font-extrabold text-[10px] md:text-[11.5px] uppercase tracking-widest"
                  >
                    🚀 PEAK PROFIT
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Horizontal X axis labels */}
          <g className="x-axis-labels">
            {coordPoints.map((pt, idx) => {
              // Conditionally hide standard ticks to prevent horizontal cramping on small displays
              const intervalRatio = Math.ceil(activeDataset.length / 10);
              const shouldRenderLabel = idx % intervalRatio === 0 || idx === activeDataset.length - 1;
              if (!shouldRenderLabel) return null;

              return (
                <text
                  key={idx}
                  x={pt.x}
                  y={paddingTop + drawableHeight + 32}
                  textAnchor="middle"
                  className="fill-[var(--foreground)] font-mono text-[11px] md:text-[12.5px] font-black opacity-95 uppercase tracking-wide"
                >
                  {pt.original.label}
                </text>
              );
            })}
          </g>

          {/* X axis line rule */}
          <line
            x1={paddingLeft}
            y1={paddingTop + drawableHeight}
            x2={svgWidth - paddingRight}
            y2={paddingTop + drawableHeight}
            stroke="var(--foreground)"
            strokeWidth="2.0"
            className="opacity-[0.25] dark:opacity-[0.3]"
          />
        </svg>

        {/* Floating Custom Tooltip Overlays */}
        <AnimatePresence>
          {hoverIndex !== null && coordPoints[hoverIndex] && (() => {
            const pctX = (coordPoints[hoverIndex].x / svgWidth) * 100;
            const pctYSales = (coordPoints[hoverIndex].ySales / svgHeight) * 100;

            // Shift tooltip horizontally to prevent clipping against container bounds
            let translateX = '-50%';
            let leftStyle = `${pctX}%`;
            if (pctX < 20) {
              translateX = '0%';
              leftStyle = `calc(${pctX}% + 12px)`;
            } else if (pctX > 80) {
              translateX = '-100%';
              leftStyle = `calc(${pctX}% - 12px)`;
            }

            // Flip tooltip vertically to render below the point if it's too close to the top
            let translateY = '-115%';
            let topStyle = `${pctYSales}%`;
            if (pctYSales < 25) {
              translateY = '15px'; // Flow below the dot
            }

            return (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className={`absolute pointer-events-none z-30 p-4 rounded-2xl min-w-[210px] shadow-2xl ${themeChartColors.cardBorder}`}
                style={{
                  left: leftStyle,
                  top: topStyle,
                  backgroundColor: 'rgba(9, 15, 29, 0.96)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                  transform: `translate(${translateX}, ${translateY})`
                }}
              >
                {/* Tooltip Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 font-mono">
                    {coordPoints[hoverIndex].original.fullLabel}
                  </span>
                  <span className="text-[9px] bg-white/10 text-slate-100 font-semibold px-2 py-0.5 rounded uppercase leading-none font-mono">
                    {coordPoints[hoverIndex].original.bills} Orders
                  </span>
                </div>

                {/* Data comparison contents - Only Sales & Profit (Profit Margin is removed as requested) */}
                <div className="space-y-2.5">
                  {/* Sales metric row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: chartSalesStroke }} />
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total Sales</span>
                    </div>
                    <span className="text-sm font-black font-mono">
                      ₹{coordPoints[hoverIndex].original.sales.toLocaleString()}
                    </span>
                  </div>

                  {/* Net profit metric row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: chartProfitStroke }} />
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Net Profit</span>
                    </div>
                    <span className="text-sm font-black font-mono text-emerald-400">
                      ₹{coordPoints[hoverIndex].original.profit.toLocaleString()}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>

          </div>
        </div>
      </div>

      {/* Viewport Virtual Scrollbar Indicator to guide zoomed navigation */}
      {zoomScale > 1 && (
        <div className="mt-3 w-full max-w-sm mx-auto h-[5px] bg-[var(--foreground)]/[0.04] rounded-full overflow-hidden border border-[var(--border)] relative">
          <div 
            className="h-full bg-[var(--primary)] rounded-full transition-all duration-100"
            style={{
              width: `${(1 / zoomScale) * 100}%`,
              transform: `translateX(${(Math.abs(panOffset) / (drawableWidth * zoomScale)) * 100}%)`,
              left: 0
            }}
          />
        </div>
      )}

      {/* Premium BI Automated Trend Insights Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 border-t border-[var(--border)] pt-6 z-10">
        
        <div className="p-4 bg-[var(--foreground)]/[0.02] border border-[var(--border)] rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] font-black text-[var(--foreground)]/50 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <TrendingUp size={11} className="text-[var(--primary)]" /> System Performance
          </span>
          <p className="text-xs font-semibold leading-relaxed text-[var(--foreground)]/80">
            Current margin aggregates stabilized at{' '}
            <strong className="text-[var(--primary)] font-black">
              {aggregatedValues.margin.toFixed(1)}%
            </strong>{' '}
            with balanced checkout velocities.
          </p>
        </div>

        <div className="p-4 bg-[var(--foreground)]/[0.02] border border-[var(--border)] rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] font-black text-[var(--foreground)]/50 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Flame size={11} className="text-amber-500 animate-pulse" /> Best Performing Period
          </span>
          <p className="text-xs font-semibold leading-relaxed text-[var(--foreground)]/80">
            Velocity peaking at{' '}
            <strong className="text-amber-500 font-extrabold uppercase">
              {aggregatedValues.peakIntervalLabel}
            </strong>{' '}
            yielding robust customer asset checkpoints.
          </p>
        </div>

        <div className="p-4 bg-[var(--foreground)]/[0.02] border border-[var(--border)] rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] font-black text-[var(--foreground)]/50 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Info size={11} className="text-teal-500" /> Average Ticket Valuation
          </span>
          <p className="text-xs font-semibold leading-relaxed text-[var(--foreground)]/80">
            Average customer basket valuation indexed at{' '}
            <strong className="text-teal-500 font-bold font-mono">
              ₹{Math.round(aggregatedValues.avgBasketValue).toLocaleString()}
            </strong>{' '}
            per transaction invoice.
          </p>
        </div>

        <div className="p-4 bg-[var(--foreground)]/[0.02] border border-[var(--border)] rounded-2xl flex flex-col justify-between">
          <span className="text-[9px] font-black text-[var(--foreground)]/50 uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Sparkles size={11} className="text-violet-500" /> Automated Trend Insight
          </span>
          <p className="text-xs font-semibold leading-relaxed text-[var(--foreground)]/80">
            {aggregatedValues.totalSales > 15000 ? (
              <span>High revenue intensity. Asset accumulation scaling ahead of storage commitments.</span>
            ) : (
              <span>Transaction frequency standard. Stock counts healthy with baseline checkouts.</span>
            )}
          </p>
        </div>

      </div>

    </div>
  );
}
