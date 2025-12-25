// STEP 3: Receivers with Packages (Each receiver has their own packages)
function Step3PackageAndReceiver({ formData, setFormData, packages, pricing, onNext, onPrev }: any) {
    const getPackagePrice = (packageId: string) => {
        const depotPrice = pricing.find(
            (p: any) => p.packageId === packageId && p.depotId === formData.destinationDepotId
        );
        if (depotPrice) return depotPrice.price;
        const pkg = packages.find((p: any) => p.id === packageId);
        return pkg?.basePrice || 0;
    };

    const validatePhone = (phone: string) => {
        const regex = /^[9876]\d{9}$/;
        return regex.test(phone);
    };

    const addReceiver = () => {
        setFormData({
            ...formData,
            receivers: [...formData.receivers, { name: '', phone: '', address: '', packages: [] }]
        });
    };

    const removeReceiver = (index: number) => {
        if (formData.receivers.length > 1) {
            const newReceivers = formData.receivers.filter((_: any, i: number) => i !== index);
            setFormData({ ...formData, receivers: newReceivers });
        }
    };

    const updateReceiver = (index: number, field: string, value: string) => {
        const newReceivers = [...formData.receivers];
        newReceivers[index] = { ...newReceivers[index], [field]: value };
        setFormData({ ...formData, receivers: newReceivers });
    };

    const updateReceiverPackage = (receiverIndex: number, packageId: string, quantity: number) => {
        const newReceivers = [...formData.receivers];
        const receiver = newReceivers[receiverIndex];

        const existingPkgIndex = receiver.packages.findIndex((p: any) => p.packageId === packageId);

        if (quantity > 0) {
            const pkg = packages.find((p: any) => p.id === packageId);
            const packageData = {
                packageId,
                size: pkg?.name || '',
                quantity,
                price: getPackagePrice(packageId)
            };

            if (existingPkgIndex >= 0) {
                receiver.packages[existingPkgIndex] = packageData;
            } else {
                receiver.packages.push(packageData);
            }
        } else {
            if (existingPkgIndex >= 0) {
                receiver.packages.splice(existingPkgIndex, 1);
            }
        }

        setFormData({ ...formData, receivers: newReceivers });
    };

    const getReceiverPackageQuantity = (receiverIndex: number, packageId: string) => {
        const receiver = formData.receivers[receiverIndex];
        const pkg = receiver.packages.find((p: any) => p.packageId === packageId);
        return pkg?.quantity || 0;
    };

    const getReceiverSubtotal = (receiver: any) => {
        return receiver.packages.reduce((sum: number, pkg: any) => sum + (pkg.quantity * pkg.price), 0);
    };

    const getGrandTotal = () => {
        return formData.receivers.reduce((sum: number, receiver: any) => sum + getReceiverSubtotal(receiver), 0);
    };

    const handleNext = () => {
        const requiresAddress = formData.deliveryType !== 'pickup';

        for (const receiver of formData.receivers) {
            if (!receiver.name || !validatePhone(receiver.phone)) {
                alert('Please complete all receiver details correctly');
                return;
            }
            if (requiresAddress && !receiver.address) {
                alert('Please provide delivery address for all receivers');
                return;
            }
            if (receiver.packages.length === 0) {
                alert(`${receiver.name || 'Each receiver'} must have at least one package`);
                return;
            }
        }

        onNext();
    };

    const requiresAddress = formData.deliveryType !== 'pickup';

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Step 3: Receivers & Packages</h2>
            <p className="text-gray-600">Add receiver details and select packages for each receiver</p>

            {formData.receivers.map((receiver: any, receiverIndex: number) => (
                <div key={receiverIndex} className="p-6 border-2 border-gray-200 rounded-lg space-y-6 bg-gray-50">
                    <div className="flex justify-between items-center pb-4 border-b border-gray-300">
                        <h3 className="text-lg font-bold text-gray-900">Receiver {receiverIndex + 1}</h3>
                        {formData.receivers.length > 1 && (
                            <button
                                onClick={() => removeReceiver(receiverIndex)}
                                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
                            >
                                Remove Receiver
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Receiver Name *</label>
                            <input
                                type="text"
                                value={receiver.name}
                                onChange={(e) => updateReceiver(receiverIndex, 'name', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                                placeholder="Enter receiver name"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Receiver Phone *</label>
                            <input
                                type="tel"
                                value={receiver.phone}
                                onChange={(e) => updateReceiver(receiverIndex, 'phone', e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                                placeholder="10-digit number"
                                maxLength={10}
                                required
                            />
                            {receiver.phone && !validatePhone(receiver.phone) && (
                                <p className="mt-1 text-sm text-red-600">Must be 10 digits starting with 9/8/7/6</p>
                            )}
                        </div>

                        {requiresAddress && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address *</label>
                                <textarea
                                    value={receiver.address}
                                    onChange={(e) => updateReceiver(receiverIndex, 'address', e.target.value)}
                                    rows={2}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                                    placeholder="Enter complete delivery address"
                                    required
                                />
                            </div>
                        )}
                    </div>

                    <div className="border-t border-gray-300 pt-4">
                        <h4 className="font-semibold text-gray-900 mb-3">📦 Packages for {receiver.name || `Receiver ${receiverIndex + 1}`}</h4>
                        <div className="space-y-3">
                            {packages.map((pkg: any) => {
                                const price = getPackagePrice(pkg.id);
                                const quantity = getReceiverPackageQuantity(receiverIndex, pkg.id);
                                return (
                                    <div key={pkg.id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:border-orange-300 transition-colors">
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">{pkg.name}</div>
                                            <div className="text-sm text-gray-600">₹{price} per unit</div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <label className="text-sm text-gray-600">Qty:</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={quantity}
                                                onChange={(e) => updateReceiverPackage(receiverIndex, pkg.id, Number(e.target.value))}
                                                className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                                            />
                                            {quantity > 0 && (
                                                <span className="text-sm font-medium text-gray-900 min-w-[80px] text-right">
                                                    = ₹{(quantity * price).toFixed(2)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-3">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-900">Subtotal for {receiver.name || `Receiver ${receiverIndex + 1}`}:</span>
                                <span className="text-lg font-bold text-orange-600">₹{getReceiverSubtotal(receiver).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            ))}

            <button
                onClick={addReceiver}
                className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-50 transition-colors font-medium"
            >
                + Add Another Receiver
            </button>

            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Grand Total (All Receivers):</span>
                    <span className="text-2xl font-bold text-green-700">₹{getGrandTotal().toFixed(2)}</span>
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <button
                    onClick={onPrev}
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                    ← Previous
                </button>
                <button
                    onClick={handleNext}
                    className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
                >
                    Next Step →
                </button>
            </div>
        </div>
    );
}

