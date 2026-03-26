// src/pages/Ecommerce.tsx
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useClient } from "@/contexts/ClientContext";
import { format } from "date-fns";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import { DeltaBadge } from "@/components/DeltaBadge";
import { fmt, fmtCurrency, fmtCompact } from "@/components/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ShoppingCart, Package, Users, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface EcommerceOrder {
  id: string;
  external_id: string;
  date: string;
  status: string;
  total: number;
  currency: string;
  customer_email: string | null;
  items_count: number | null;
  utm_source: string | null;
}

interface EcommerceProduct {
  id: string;
  external_id: string;
  name: string;
  price: number | null;
  stock: number | null;
  category: string | null;
  is_active: boolean;
}

interface EcommerceCustomer {
  id: string;
  email: string | null;
  orders_count: number;
  total_spent: number;
  first_order_at: string | null;
  last_order_at: string | null;
  segment: string;
}

interface EcommerceCart {
  id: string;
  customer_email: string | null;
  value: number;
  status: string;
  abandoned_at: string;
  recovered_at: string | null;
}

interface EcommerceData {
  orders: EcommerceOrder[];
  products: EcommerceProduct[];
  customers: EcommerceCustomer[];
  carts: EcommerceCart[];
  revenueMtd: number;
  ordersCount: number;
  avgTicket: number;
  newCustomers: number;
  abandonedValue: number;
  abandonedCount: number;
  prevRevenueMtd: number;
  prevOrdersCount: number;
  prevAvgTicket: number;
  prevNewCustomers: number;
}

function useEcommerceData() {
  const { currentWorkspace, dateRange } = useWorkspace();
  const { selectedClient } = useClient();
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  const clientId = selectedClient?.id ?? null;

  const daysCount = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1;
  const prevTo = new Date(dateRange.from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - (daysCount - 1) * 86400000);
  const prevFromStr = format(prevFrom, "yyyy-MM-dd");
  const prevToStr = format(prevTo, "yyyy-MM-dd");

  return useQuery({
    queryKey: ["ecommerce", currentWorkspace?.id, clientId, fromStr, toStr],
    queryFn: async (): Promise<EcommerceData> => {
      if (!currentWorkspace) return emptyData();

      let ordersQ = (supabase as any)
        .from("ecommerce_orders")
        .select("id, external_id, date, status, total, currency, customer_email, items_count, utm_source")
        .eq("workspace_id", currentWorkspace.id)
        .gte("date", fromStr)
        .lte("date", toStr)
        .order("date", { ascending: false })
        .limit(200);
      if (clientId) ordersQ = ordersQ.eq("client_id", clientId);

      let productsQ = (supabase as any)
        .from("ecommerce_products")
        .select("id, external_id, name, price, stock, category, is_active")
        .eq("workspace_id", currentWorkspace.id)
        .order("name");
      if (clientId) productsQ = productsQ.eq("client_id", clientId);

      let customersQ = (supabase as any)
        .from("ecommerce_customers")
        .select("id, email, orders_count, total_spent, first_order_at, last_order_at, segment")
        .eq("workspace_id", currentWorkspace.id)
        .order("total_spent", { ascending: false })
        .limit(200);
      if (clientId) customersQ = customersQ.eq("client_id", clientId);

      let cartsQ = (supabase as any)
        .from("ecommerce_carts")
        .select("id, customer_email, value, status, abandoned_at, recovered_at")
        .eq("workspace_id", currentWorkspace.id)
        .gte("abandoned_at", fromStr + "T00:00:00")
        .lte("abandoned_at", toStr + "T23:59:59")
        .order("abandoned_at", { ascending: false });
      if (clientId) cartsQ = cartsQ.eq("client_id", clientId);

      let prevOrdersQ = (supabase as any)
        .from("ecommerce_orders")
        .select("total, status, customer_email, date")
        .eq("workspace_id", currentWorkspace.id)
        .gte("date", prevFromStr)
        .lte("date", prevToStr);
      if (clientId) prevOrdersQ = prevOrdersQ.eq("client_id", clientId);

      const [ordersRes, productsRes, customersRes, cartsRes, prevOrdersRes] = await Promise.all([
        ordersQ, productsQ, customersQ, cartsQ, prevOrdersQ,
      ]);

      const orders = (ordersRes.data ?? []) as EcommerceOrder[];
      const products = (productsRes.data ?? []) as EcommerceProduct[];
      const customers = (customersRes.data ?? []) as EcommerceCustomer[];
      const carts = (cartsRes.data ?? []) as EcommerceCart[];
      const prevOrders = prevOrdersRes.data ?? [];

      const paidOrders = orders.filter((o) => o.status === "paid");
      const revenueMtd = paidOrders.reduce((s, o) => s + Number(o.total), 0);
      const ordersCount = paidOrders.length;
      const avgTicket = ordersCount > 0 ? revenueMtd / ordersCount : 0;
      const newCustomers = customers.filter((c) => c.segment === "new").length;
      const abandonedCarts = carts.filter((c) => c.status === "abandoned");
      const abandonedValue = abandonedCarts.reduce((s, c) => s + Number(c.value), 0);
      const abandonedCount = abandonedCarts.length;

      const prevPaid = prevOrders.filter((o: any) => o.status === "paid");
      const prevRevenueMtd = prevPaid.reduce((s: number, o: any) => s + Number(o.total), 0);
      const prevOrdersCount = prevPaid.length;
      const prevAvgTicket = prevOrdersCount > 0 ? prevRevenueMtd / prevOrdersCount : 0;
      const prevEmails = new Set(prevOrders.map((o: any) => o.customer_email).filter(Boolean));
      const prevNewCustomers = prevEmails.size;

      return {
        orders, products, customers, carts,
        revenueMtd, ordersCount, avgTicket, newCustomers,
        abandonedValue, abandonedCount,
        prevRevenueMtd, prevOrdersCount, prevAvgTicket, prevNewCustomers,
      };
    },
    enabled: !!currentWorkspace,
  });
}

function emptyData(): EcommerceData {
  return {
    orders: [], products: [], customers: [], carts: [],
    revenueMtd: 0, ordersCount: 0, avgTicket: 0, newCustomers: 0,
    abandonedValue: 0, abandonedCount: 0,
    prevRevenueMtd: 0, prevOrdersCount: 0, prevAvgTicket: 0, prevNewCustomers: 0,
  };
}

const orderStatusConfig: Record<string, { label: string; className: string }> = {
  paid: { label: "Pagado", className: "bg-success/10 text-success" },
  pending: { label: "Pendiente", className: "bg-warning/10 text-warning" },
  cancelled: { label: "Cancelado", className: "bg-destructive/10 text-destructive" },
  refunded: { label: "Devuelto", className: "bg-muted text-muted-foreground" },
};

const segmentConfig: Record<string, { label: string; className: string }> = {
  new: { label: "Nuevo", className: "bg-info/10 text-info" },
  returning: { label: "Recurrente", className: "bg-primary/10 text-primary" },
  vip: { label: "VIP", className: "bg-warning/10 text-warning" },
};

function utmColor(source: string | null): string {
  if (!source) return "text-muted-foreground";
  if (source.toLowerCase().includes("facebook") || source.toLowerCase().includes("meta")) return "text-info";
  if (source.toLowerCase().includes("google")) return "text-success";
  return "text-muted-foreground";
}

function KpiStrip({ data }: { data: EcommerceData }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border rounded-lg overflow-hidden">
      {[
        {
          label: "Revenue Real",
          value: fmtCurrency(data.revenueMtd),
          current: data.revenueMtd,
          prev: data.prevRevenueMtd,
          valueClass: "text-success",
          sub: null,
        },
        {
          label: "Órdenes",
          value: fmt(data.ordersCount),
          current: data.ordersCount,
          prev: data.prevOrdersCount,
          valueClass: "",
          sub: null,
        },
        {
          label: "Ticket Promedio",
          value: fmtCurrency(data.avgTicket),
          current: data.avgTicket,
          prev: data.prevAvgTicket,
          valueClass: "",
          sub: null,
        },
        {
          label: "Clientes Nuevos",
          value: fmt(data.newCustomers),
          current: data.newCustomers,
          prev: data.prevNewCustomers,
          valueClass: "",
          sub: null,
        },
        {
          label: "Carritos Abandon.",
          value: fmtCurrency(data.abandonedValue),
          current: 0,
          prev: 0,
          valueClass: "",
          sub: `${data.abandonedCount} carritos`,
        },
      ].map((kpi) => (
        <div key={kpi.label} className="bg-background p-4">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{kpi.label}</p>
          <p className={cn("text-xl font-bold", kpi.valueClass)}>{kpi.value}</p>
          <div className="mt-0.5">
            {kpi.sub
              ? <span className="text-[10px] text-muted-foreground">{kpi.sub}</span>
              : <DeltaBadge current={kpi.current} prev={kpi.prev} />
            }
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersTab({ orders }: { orders: EcommerceOrder[] }) {
  if (orders.length === 0) return <EmptyState title="Sin órdenes" description="No hay órdenes en el período." />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">#Orden</TableHead>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs">Fecha</TableHead>
              <TableHead className="text-xs text-right">Total</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
              <TableHead className="text-xs">Fuente UTM</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((o) => {
              const statusCfg = orderStatusConfig[o.status] ?? { label: o.status, className: "text-muted-foreground" };
              return (
                <TableRow key={o.id}>
                  <TableCell className="text-xs text-muted-foreground">#{o.external_id}</TableCell>
                  <TableCell className="text-xs">{o.customer_email ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.date}</TableCell>
                  <TableCell className="text-xs text-right font-semibold tabular-nums text-success">
                    {fmtCurrency(o.total)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-[10px] border-0", statusCfg.className)}>
                      {statusCfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn("text-xs", utmColor(o.utm_source))}>
                    {o.utm_source ?? "Orgánico"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ProductsTab({ products }: { products: EcommerceProduct[] }) {
  if (products.length === 0) return <EmptyState title="Sin productos" description="No hay productos sincronizados." />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Producto</TableHead>
              <TableHead className="text-xs">Categoría</TableHead>
              <TableHead className="text-xs text-right">Precio</TableHead>
              <TableHead className="text-xs text-right">Stock</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-xs font-medium max-w-[200px] truncate">{p.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{p.category ?? "—"}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">{p.price != null ? fmtCurrency(p.price) : "—"}</TableCell>
                <TableCell className="text-xs text-right tabular-nums">
                  {p.stock != null
                    ? <span className={cn(p.stock <= 5 ? "text-destructive font-medium" : "text-foreground")}>{p.stock}</span>
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-[10px] border-0", p.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                    {p.is_active ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CustomersTab({ customers }: { customers: EcommerceCustomer[] }) {
  if (customers.length === 0) return <EmptyState title="Sin clientes" description="No hay clientes sincronizados." />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs text-right">Órdenes</TableHead>
              <TableHead className="text-xs text-right">LTV</TableHead>
              <TableHead className="text-xs">Primera Compra</TableHead>
              <TableHead className="text-xs">Última Compra</TableHead>
              <TableHead className="text-xs">Segmento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => {
              const segCfg = segmentConfig[c.segment] ?? { label: c.segment, className: "text-muted-foreground" };
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-xs">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{c.orders_count}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-medium">{fmtCurrency(c.total_spent)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.first_order_at ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.last_order_at ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("text-[10px] border-0", segCfg.className)}>
                      {segCfg.label}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CartsTab({ carts }: { carts: EcommerceCart[] }) {
  if (carts.length === 0) return <EmptyState title="Sin carritos" description="No hay carritos abandonados en el período." />;
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Cliente</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs">Abandonado</TableHead>
              <TableHead className="text-xs">Recuperado</TableHead>
              <TableHead className="text-xs">Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carts.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-xs">{c.customer_email ?? "Anónimo"}</TableCell>
                <TableCell className="text-xs text-right tabular-nums font-medium">{fmtCurrency(c.value)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.abandoned_at.split("T")[0]}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{c.recovered_at?.split("T")[0] ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={cn("text-[10px] border-0",
                    c.status === "recovered" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  )}>
                    {c.status === "recovered" ? "Recuperado" : "Abandonado"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

const Ecommerce = () => {
  const { data, isLoading } = useEcommerceData();
  const { selectedClient } = useClient();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SectionHeader badge="Ecommerce" title="Tienda Online" />
        <div className="grid grid-cols-5 gap-px bg-border rounded-lg overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  const hasData = data && data.ordersCount > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionHeader
        badge="Ecommerce"
        title="Tienda Online"
        subtitle={selectedClient ? selectedClient.name : "Workspace global"}
      />

      {!hasData ? (
        <EmptyState
          title="Sin datos de ecommerce"
          description="Conectá una tienda en Client Hub → Tienda Online para empezar a sincronizar."
        />
      ) : (
        <>
          <KpiStrip data={data} />

          <Tabs defaultValue="orders">
            <TabsList className="h-9">
              <TabsTrigger value="orders" className="text-xs gap-1.5">
                <ShoppingCart className="h-3.5 w-3.5" /> Órdenes
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.ordersCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="products" className="text-xs gap-1.5">
                <Package className="h-3.5 w-3.5" /> Productos
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.products.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="customers" className="text-xs gap-1.5">
                <Users className="h-3.5 w-3.5" /> Clientes
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.customers.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="carts" className="text-xs gap-1.5">
                <BarChart3 className="h-3.5 w-3.5" /> Carritos
                <Badge variant="secondary" className="text-[9px] h-4 px-1">{data.abandonedCount}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-4">
              <OrdersTab orders={data.orders} />
            </TabsContent>
            <TabsContent value="products" className="mt-4">
              <ProductsTab products={data.products} />
            </TabsContent>
            <TabsContent value="customers" className="mt-4">
              <CustomersTab customers={data.customers} />
            </TabsContent>
            <TabsContent value="carts" className="mt-4">
              <CartsTab carts={data.carts} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default Ecommerce;
