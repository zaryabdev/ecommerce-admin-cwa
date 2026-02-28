"use client";

import { Modal } from "@/components/ui/modal";
import type { OrderColumn } from "./columns";

export default function OrderDetailsModal({
    open,
    onClose,
    order,
}: {
    open: boolean;
    onClose: () => void;
    order: OrderColumn;
}) {
    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title="Order details"
            description=""
        >
            <div className="space-y-5">
                {/* Top meta */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="p-3 border rounded-xl">
                        <div className="text-xs text-gray-500">Tracking</div>
                        <div className="mt-1 font-mono text-sm">
                            {order.trackingId}
                        </div>
                    </div>

                    <div className="p-3 border rounded-xl">
                        <div className="text-xs text-gray-500">Status</div>
                        <div className="mt-1 text-sm font-medium">
                            {order.status} • {order.isPaid ? "Paid" : "Unpaid"}
                        </div>
                    </div>

                    <div className="p-3 border rounded-xl">
                        <div className="text-xs text-gray-500">
                            Payment method
                        </div>
                        <div className="mt-1 text-sm font-medium">
                            {order.paymentMethod}
                        </div>
                    </div>

                    <div className="p-3 border rounded-xl">
                        <div className="text-xs text-gray-500">Total</div>
                        <div className="mt-1 text-sm font-semibold">
                            {order.totalPrice}
                        </div>
                    </div>
                </div>

                {/* Customer */}
                <div className="p-4 border rounded-2xl">
                    <div className="text-sm font-semibold text-gray-900">
                        Customer
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                        <div>
                            <span className="text-gray-500">Name:</span>{" "}
                            {order.customerName || "—"}
                        </div>
                        <div>
                            <span className="text-gray-500">Email:</span>{" "}
                            {order.email || "—"}
                        </div>
                        <div>
                            <span className="text-gray-500">Phone:</span>{" "}
                            {order.phone || "—"}
                        </div>
                    </div>
                </div>

                {/* Shipping */}
                <div className="p-4 border rounded-2xl">
                    <div className="text-sm font-semibold text-gray-900">
                        Shipping
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                        <div>{order.shippingAddress || "—"}</div>

                        {order.customerNotes ? (
                            <div className="p-3 mt-3 text-sm rounded-xl bg-gray-50">
                                <div className="text-xs font-medium text-gray-700">
                                    Delivery notes
                                </div>
                                <div className="mt-1 text-gray-700">
                                    {order.customerNotes}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Items */}
                <div className="p-4 border rounded-2xl">
                    <div className="text-sm font-semibold text-gray-900">
                        Items
                    </div>
                    <div className="mt-2 text-sm text-gray-700">
                        {order.products || "—"}
                    </div>
                </div>
            </div>
        </Modal>
    );
}
