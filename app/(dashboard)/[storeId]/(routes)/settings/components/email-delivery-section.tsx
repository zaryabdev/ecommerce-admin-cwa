"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-hot-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Modal } from "@/components/ui/modal";
import { Separator } from "@/components/ui/separator";

interface EmailDeliverySectionProps {
    storeId: string;
    initialBlocked: boolean;
}

export function EmailDeliverySection({
    storeId,
    initialBlocked,
}: EmailDeliverySectionProps) {
    const router = useRouter();
    const [blocked, setBlocked] = useState(initialBlocked);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const update = async (emailDeliveryBlocked: boolean) => {
        try {
            setLoading(true);
            const { data } = await axios.patch<{ emailDeliveryBlocked: boolean }>(
                `/api/stores/${storeId}/email-settings`,
                { emailDeliveryBlocked },
            );
            setBlocked(data.emailDeliveryBlocked);
            setConfirmOpen(false);
            router.refresh();
            toast.success(
                data.emailDeliveryBlocked
                    ? "All email is now blocked for this store."
                    : "Email is now allowed for this store.",
            );
        } catch (error: any) {
            toast.error("Something went wrong.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4">
            <Modal
                title="Block all email?"
                description="Storvia will stop sending new-order notifications, invoice emails, and other Store email until you allow email again. Orders and invoices will continue to work normally."
                isOpen={confirmOpen}
                onClose={() => setConfirmOpen(false)}
            >
                <div className="pt-6 space-x-2 flex items-center justify-end w-full">
                    <Button
                        disabled={loading}
                        variant="outline"
                        onClick={() => setConfirmOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled={loading}
                        variant="destructive"
                        onClick={() => update(true)}
                    >
                        Block all email
                    </Button>
                </div>
            </Modal>
            <Heading
                title="Email delivery"
                description="Control the email Storvia sends for this store"
            />
            <Separator />
            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                        <CardTitle>Store email</CardTitle>
                        <CardDescription>
                            Blocks all Storvia-generated email for this Store,
                            including new-order notifications and invoice emails.
                            Orders and invoices will continue to work normally.
                        </CardDescription>
                    </div>
                    <Badge
                        variant={blocked ? "destructive" : "default"}
                        className="shrink-0"
                    >
                        {blocked ? "Blocked" : "Active"}
                    </Badge>
                </CardHeader>
                <CardContent>
                    {blocked ? (
                        <Button
                            disabled={loading}
                            variant="outline"
                            onClick={() => update(false)}
                        >
                            Allow all email
                        </Button>
                    ) : (
                        <Button
                            disabled={loading}
                            variant="destructive"
                            onClick={() => setConfirmOpen(true)}
                        >
                            Block all email
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
