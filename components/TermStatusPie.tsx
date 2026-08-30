"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Graduated: "#3F7D4F",
  "In Session": "#0F7268",
  Completed: "#2C3E66",
  Attachment: "#6B4FA3",
  Dropped: "#B0432E",
  Deferred: "#C2760F",
  Clinicals: "#8B6BAF",
  "Not Yet Reported": "#98A39C",
  Unmarked: "#C9CFC5",
};

export default function TermStatusPie({ statusCounts }: { statusCounts: Record<string, number> }) {
  const data = Object.entries(statusCounts)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  if (data.length === 0) {
    return <div style={{ fontSize: 11, color: "#98A39C", fontStyle: "italic", padding: "18px 0" }}>No data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={104}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={26} outerRadius={46} paddingAngle={2} stroke="none">
          {data.map((entry) => (
            <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#98A39C"} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number, name: string) => [value, name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}
