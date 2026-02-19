"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
  parseISO,
} from "date-fns";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  vendor_id: string;
  vendor_name: string;
  trade_type: string;
  expiry_date: string;
  status: string;
  reasons: string[];
}

const STATUS_COLORS: Record<string, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-500",
  red: "bg-red-500",
};

export default function ComplianceCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/compliance/calendar");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setEvents(data.events || []);
      } catch {
        toast.error("Failed to load calendar data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = event.expiry_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(event);
    }
    return map;
  }, [events]);

  const selectedEvents = useMemo(() => {
    if (!selectedDate) return [];
    const key = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(key) || [];
  }, [selectedDate, eventsByDate]);

  // Upcoming expirations (next 30 days)
  const upcoming = useMemo(() => {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return events
      .filter((e) => {
        const d = parseISO(e.expiry_date);
        return d >= now && d <= thirtyDays;
      })
      .slice(0, 10);
  }, [events]);

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <div>
        <h1 className="text-2xl font-serif font-semibold">Compliance Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Track COI expiration dates across your vendor portfolio
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Calendar */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="size-5" />
                {format(currentMonth, "MMMM yyyy")}
              </CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Day headers */}
              <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayEvents = eventsByDate.get(dateKey) || [];
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <button
                      key={dateKey}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "relative flex flex-col items-center justify-start p-1 h-16 border border-border/50 text-sm transition-colors hover:bg-accent",
                        !isCurrentMonth && "text-muted-foreground/40",
                        mounted && isToday(day) && "bg-primary/5 font-bold",
                        isSelected && "ring-2 ring-primary bg-primary/10"
                      )}
                    >
                      <span className="text-xs">{format(day, "d")}</span>
                      {dayEvents.length > 0 && (
                        <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                          {dayEvents.slice(0, 3).map((e, i) => (
                            <span
                              key={i}
                              className={cn(
                                "size-1.5 rounded-full",
                                STATUS_COLORS[e.status] || "bg-gray-400"
                              )}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{dayEvents.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected date details */}
            {selectedDate && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {format(selectedDate, "MMMM d, yyyy")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No expirations on this date.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedEvents.map((e) => (
                        <div
                          key={e.vendor_id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span
                            className={cn(
                              "mt-1.5 size-2 rounded-full shrink-0",
                              STATUS_COLORS[e.status] || "bg-gray-400"
                            )}
                          />
                          <div>
                            <p className="font-medium">{e.vendor_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {e.trade_type}
                            </p>
                            {e.reasons.length > 0 && (
                              <p className="text-xs text-red-600 mt-0.5">
                                {(e.reasons as string[]).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Upcoming expirations */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="size-4 text-yellow-500" />
                  Upcoming Expirations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {upcoming.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No expirations in the next 30 days.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((e) => (
                      <div
                        key={e.vendor_id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant={
                              e.status === "red"
                                ? "destructive"
                                : e.status === "yellow"
                                ? "outline"
                                : "secondary"
                            }
                            className="text-xs shrink-0"
                          >
                            {e.status}
                          </Badge>
                          <span className="truncate">{e.vendor_name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                          {format(parseISO(e.expiry_date), "MMM d")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
