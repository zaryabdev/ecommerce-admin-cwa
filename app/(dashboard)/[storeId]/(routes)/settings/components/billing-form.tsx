"use client";

import axios from "axios";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Heading } from "@/components/ui/heading";

const schema = z.object({
  legalName: z.string().max(255).optional(), billingContactName: z.string().max(255).optional(),
  billingEmail: z.union([z.string().email(), z.literal("")]).optional(), billingPhone: z.string().max(255).optional(),
  addressLine1: z.string().max(255).optional(), addressLine2: z.string().max(255).optional(), city: z.string().max(255).optional(), postalCode: z.string().max(255).optional(), country: z.string().max(255).optional(), taxNumber: z.string().max(255).optional(), companyRegistrationNumber: z.string().max(255).optional(), currency: z.string().regex(/^[A-Za-z]{3}$/).optional(),
});
type Values = z.infer<typeof schema>;
const names: { name: keyof Values; label: string }[] = [
  { name: "legalName", label: "Legal / Company Name" }, { name: "billingContactName", label: "Billing Contact Name" }, { name: "billingEmail", label: "Billing Email" }, { name: "billingPhone", label: "Billing Phone" }, { name: "addressLine1", label: "Address Line 1" }, { name: "addressLine2", label: "Address Line 2" }, { name: "city", label: "City" }, { name: "postalCode", label: "Postal Code" }, { name: "country", label: "Country" }, { name: "taxNumber", label: "Tax / VAT Number" }, { name: "companyRegistrationNumber", label: "Company Registration Number" }, { name: "currency", label: "Currency (ISO 3-letter code)" },
];

export function BillingForm() {
  const params = useParams(); const [loading, setLoading] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: Object.fromEntries(names.map(({ name }) => [name, ""])) as Values });
  useEffect(() => { axios.get(`/api/stores/${params.storeId}/billing-profile`).then(({ data }) => { if (data) form.reset(Object.fromEntries(names.map(({ name }) => [name, data[name] ?? ""])) as Values); }).catch(() => toast.error("Could not load billing information.")); }, [params.storeId, form]);
  async function onSubmit(data: Values) { try { setLoading(true); await axios.patch(`/api/stores/${params.storeId}/billing-profile`, data); toast.success("Billing information saved."); } catch { toast.error("Something went wrong."); } finally { setLoading(false); } }
  return <div className="space-y-4"><Heading title="Billing information" description="Company details used for future invoices" /><Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8"><div className="grid grid-cols-1 gap-8 md:grid-cols-3">{names.map(({ name, label }) => <FormField key={name} control={form.control} name={name} render={({ field }) => <FormItem><FormLabel>{label}</FormLabel><FormControl><Input disabled={loading} {...field} /></FormControl><FormMessage /></FormItem>} />)}</div><Button disabled={loading} type="submit">Save billing information</Button></form></Form></div>;
}
