import { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
}

// Static cursor prevents recharts from re-rendering the entire chart tree on every mousemove
const staticCursor = { stroke: "var(--border)", strokeWidth: 1 }

const lineChartDot = { fill: "var(--chart-1)", strokeWidth: 2, r: 3 }
const chartMargin = { top: 10, right: 10, left: -20, bottom: 0 }
const complianceChartMargin = { top: 10, right: 10, left: -10, bottom: 0 }

interface DashboardChartsProps {
  chartData: Array<{
    name: string
    total: number
    violations: number
    compliance: number | null
  }>
  helmetPieData: Array<{
    name: string
    value: number
    color: string
  }>
  labels: {
    totalViolations: string
    totalDetections: string
    complianceRate: string
  }
  complianceByDayLabel: string
  helmetComplianceLabel: string
}

const DashboardCharts = memo(function DashboardCharts({ 
  chartData, 
  helmetPieData, 
  labels,
  complianceByDayLabel,
  helmetComplianceLabel,
}: DashboardChartsProps) {
  return (
    <>
      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Violations Trend Chart */}
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg font-bold">{complianceByDayLabel}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280} debounce={50}>
              <AreaChart data={chartData} margin={chartMargin}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                <XAxis 
                  dataKey="name" 
                  stroke="var(--muted-foreground)" 
                  fontSize={11}
                  tickLine={false}
                  minTickGap={25}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke="var(--muted-foreground)" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  animationDuration={0}
                  cursor={staticCursor}
                />
                <Area
                  type="monotone"
                  dataKey="violations"
                  stroke="var(--chart-3)"
                  fill="var(--chart-3)"
                  fillOpacity={0.25}
                  name={labels.totalViolations}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="var(--chart-1)"
                  fill="var(--chart-1)"
                  fillOpacity={0.08}
                  name={labels.totalDetections}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Helmet Compliance Pie Chart */}
        <Card className="rounded-2xl border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg font-bold">{helmetComplianceLabel}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240} debounce={50}>
              <PieChart>
                <Pie
                  data={helmetPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={4}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {helmetPieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  animationDuration={0}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-3">
              {helmetPieData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></div>
                  <span className="text-xs text-muted-foreground font-medium">{item.name}</span>
                  <span className="text-xs font-bold text-foreground">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Rate Trend */}
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg font-bold">{labels.complianceRate}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240} debounce={50}>
            <LineChart data={chartData} margin={complianceChartMargin}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
              <XAxis 
                dataKey="name" 
                stroke="var(--muted-foreground)" 
                fontSize={11}
                tickLine={false}
                minTickGap={25}
                interval="preserveStartEnd"
              />
              <YAxis 
                stroke="var(--muted-foreground)" 
                fontSize={11} 
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                animationDuration={0}
                cursor={staticCursor}
              />
              <Line
                type="monotone"
                dataKey="compliance"
                connectNulls
                stroke="var(--chart-1)"
                strokeWidth={2.5}
                dot={lineChartDot}
                name={labels.complianceRate}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </>
  )
})

export default DashboardCharts
