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
                <div className="flex w-full flex-col-reverse items-stretch gap-2 pt-6 sm:flex-row sm:items-center sm:justify-end sm:space-x-2">
                    <Button
                        disabled={loading}
                        variant="outline"
                        className="w-full sm:w-auto"
                        onClick={() => setConfirmOpen(false)}
                    >
                        Cancel
                    </Button>
                    <Button
                        disabled={loading}
                        variant="destructive"
                        className="w-full sm:w-auto"
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
                <CardHeader className="flex min-w-0 flex-col items-start justify-between gap-3 space-y-0 sm:flex-row sm:items-start sm:gap-4">
                    <div className="min-w-0">
                        <CardTitle className="break-words">Store email</CardTitle>
                        <CardDescription className="break-words">
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
                <CardContent className="min-w-0">
                    {blocked ? (
                        <Button
                            disabled={loading}
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => update(false)}
                        >
                            Allow all email
                        </Button>
                    ) : (
                        <Button
                            disabled={loading}
                            variant="destructive"
                            className="w-full sm:w-auto"
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
