import React, { useState, useEffect, useCallback, useRef } from 'react';
// jsPDF is dynamically imported when needed to reduce initial bundle size
import { depotsApi, packagesApi, depotPricingApi, bookingsApi, seasonApi, contactsApi, receiptsApi } from '../utils/api';
import ContactAutocomplete from './ContactAutocomplete';
import { useBookingStore, useSyncStore, useOnlineStore } from '../stores';
import { queueOperation, processQueue } from '../utils/syncEngine';

// Types
interface ReceiverPackage {
  packageId: string;
  size: string;
  quantity: number;
  price: number;
  description?: string; // For "Other" package type
}

interface Receiver {
  name: string;
  phone: string;
  address: string;
  packages: ReceiverPackage[];
}

interface BookingFormData {
  originDepotId: string;
  destinationDepotId: string;
  paymentMethod: 'cash' | 'online' | 'to_pay' | 'credit';
  deliveryType: 'pickup' | 'home_sender' | 'home_topay' | 'home_drt';
  deliveryCharge: number;
  customInstructions: string;
  senderName: string;
  senderPhone: string;
  receivers: Receiver[];
}

interface NewBookingProps {
  onNavigate?: (page: string) => void;
}

export default function NewBooking({ onNavigate }: NewBookingProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [season, setSeason] = useState<any>(null);
  const [isSeasonActive, setIsSeasonActive] = useState(true);
  const [depots, setDepots] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [receiptNumber, setReceiptNumber] = useState('');
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  // Zustand stores for offline support
  const { draft, hasDraft, saveDraft, clearDraft, lastSavedAt, pendingBookingId, setPendingBookingId } = useBookingStore();
  const isOnline = useOnlineStore((state) => state.isOnline);
  const pendingOperations = useSyncStore((state) => state.pendingOperations);

  const [formData, setFormData] = useState<BookingFormData>({
    originDepotId: '',
    destinationDepotId: '',
    paymentMethod: 'cash',
    deliveryType: 'pickup',
    deliveryCharge: 0,
    customInstructions: '',
    senderName: '',
    senderPhone: '',
    receivers: [{ name: '', phone: '', address: '', packages: [] }]
  });

  // Check for draft on mount
  useEffect(() => {
    if (hasDraft && draft) {
      // Check if draft is from last 24 hours
      if (lastSavedAt) {
        const hoursSinceLastSave = (Date.now() - new Date(lastSavedAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastSave < 24) {
          setShowDraftPrompt(true);
        } else {
          // Draft is too old, clear it
          clearDraft();
        }
      }
    }
  }, []);

  // Auto-save form data as draft (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      // Only save if there's meaningful data
      if (formData.senderName || formData.senderPhone || formData.originDepotId) {
        saveDraft(formData);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [formData, saveDraft]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [depotsRes, packagesRes, pricingRes, seasonRes] = await Promise.all([
        depotsApi.getAll(),
        packagesApi.getAll(),
        depotPricingApi.getAll(),
        seasonApi.get()
      ]);
      const loadedDepots = depotsRes.depots || [];
      setDepots(loadedDepots);
      setPackages(packagesRes.packages || []);
      setPricing(pricingRes.pricing || []);

      // Set Devgad as default origin depot (most frequently used)
      const devgadDepot = loadedDepots.find((d: any) => d.name?.toLowerCase() === 'devgad' && d.type === 'origin');
      if (devgadDepot) {
        setFormData(prev => ({ ...prev, originDepotId: devgadDepot.id }));
      }
      if (seasonRes.season) {
        setSeason(seasonRes.season);
        // Calculate is_active based on current date
        const today = new Date();
        const startDate = new Date(seasonRes.season.startDate);
        const endDate = new Date(seasonRes.season.endDate);
        const isActive = today >= startDate && today <= endDate;
        setIsSeasonActive(isActive);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const validatePhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);

  const getPackagePrice = (packageId: string, depotId: string) => {
    const priceEntry = pricing.find(
      (p: any) => p.packageId === packageId && p.depotId === depotId
    );
    return priceEntry?.price || packages.find((p: any) => p.id === packageId)?.base_price || 0;
  };

  const calculateTotal = () => {
    let total = 0;
    formData.receivers.forEach(receiver => {
      receiver.packages.forEach(pkg => {
        total += pkg.quantity * pkg.price;
      });
    });
    return total + (formData.deliveryCharge || 0);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Debug logging for offline status
    console.log('[NewBooking] handleSubmit called');
    console.log('[NewBooking] isOnline from store:', isOnline);
    console.log('[NewBooking] navigator.onLine:', navigator.onLine);

    try {
      const bookingData = {
        origin_depot_id: formData.originDepotId,
        destination_depot_id: formData.destinationDepotId,
        payment_method: formData.paymentMethod,
        delivery_type: formData.deliveryType,
        delivery_charges: formData.deliveryCharge,
        sender_name: formData.senderName,
        sender_phone: formData.senderPhone,
        receivers: formData.receivers,
        subtotal: calculateTotal() - (formData.deliveryCharge || 0),
        total_amount: calculateTotal(),
        current_status: 'booked',
        special_instructions: formData.customInstructions
      };

      if (isOnline) {
        // Online: Try to create booking directly
        try {
          const result = await bookingsApi.create(bookingData);
          const newReceiptNumber = result.booking?.receipt_number || result.booking?.id || 'Unknown';
          setReceiptNumber(newReceiptNumber);

          // Save contacts for future autocomplete
          if (formData.senderName && formData.senderPhone) {
            await contactsApi.upsert(formData.senderName, formData.senderPhone).catch(console.error);
          }
          for (const receiver of formData.receivers) {
            if (receiver.name && receiver.phone) {
              await contactsApi.upsert(receiver.name, receiver.phone).catch(console.error);
            }
          }

          // Clear draft on successful submission
          clearDraft();
          setCurrentStep(5); // Confirmation
        } catch (error: any) {
          console.error('Error creating booking:', error);

          // Check if it's a network error - if so, queue it
          const errorMessage = error.message?.toLowerCase() || '';
          const isNetworkError =
            errorMessage.includes('fetch') ||
            errorMessage.includes('network') ||
            errorMessage.includes('failed to fetch') ||
            errorMessage.includes('err_name_not_resolved') ||
            errorMessage.includes('err_internet_disconnected') ||
            errorMessage.includes('err_connection') ||
            errorMessage.includes('err_network') ||
            errorMessage.includes('net::') ||
            errorMessage.includes('timeout') ||
            errorMessage.includes('abort') ||
            error.name === 'TypeError' ||  // Fetch throws TypeError on network failure
            error.code === 'ECONNREFUSED' ||
            !navigator.onLine;  // Also check browser's online status

          if (isNetworkError) {
            console.log('[NewBooking] Network error detected, queuing operation');
            const operationId = queueOperation('CREATE_BOOKING', bookingData, {
              entityType: 'booking',
              optimisticData: { formData, createdAt: new Date().toISOString() }
            });
            setPendingBookingId(operationId);
            setReceiptNumber('PENDING-' + operationId.slice(-8).toUpperCase());
            clearDraft();
            setCurrentStep(5); // Show confirmation with pending status
          } else {
            // Non-network error, show error to user
            alert('Failed to create booking. Please try again.');
          }
        }
      } else {
        // Offline: Queue the operation
        const operationId = queueOperation('CREATE_BOOKING', bookingData, {
          entityType: 'booking',
          optimisticData: { formData, createdAt: new Date().toISOString() }
        });

        setPendingBookingId(operationId);
        setReceiptNumber('PENDING-' + operationId.slice(-8).toUpperCase());
        clearDraft();
        setCurrentStep(5); // Show confirmation with pending status
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Swipe gesture handling for mobile
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger if horizontal swipe is greater than vertical (not scrolling)
    // and swipe distance is at least 50px
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0 && currentStep < 4) {
        // Swipe left - go to next step
        setCurrentStep(prev => Math.min(prev + 1, 4));
      } else if (deltaX > 0 && currentStep > 1) {
        // Swipe right - go to previous step
        setCurrentStep(prev => Math.max(prev - 1, 1));
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 5));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
  const goToStep = (step: number) => setCurrentStep(step);

  const resetForm = () => {
    // Find Devgad depot to set as default
    const devgadDepot = depots.find((d: any) => d.name?.toLowerCase() === 'devgad' && d.type === 'origin');

    setFormData({
      originDepotId: devgadDepot?.id || '',
      destinationDepotId: '',
      paymentMethod: 'cash',
      deliveryType: 'pickup',
      deliveryCharge: 0,
      customInstructions: '',
      senderName: '',
      senderPhone: '',
      receivers: [{ name: '', phone: '', address: '', packages: [] }]
    });
    setReceiptNumber('');
    setCurrentStep(1);
    clearDraft();
    setPendingBookingId(null);
  };

  // Handle draft restoration
  const restoreDraft = () => {
    if (draft) {
      setFormData(draft);
    }
    setShowDraftPrompt(false);
  };

  const dismissDraft = () => {
    clearDraft();
    setShowDraftPrompt(false);
  };

  // Check if season is active
  if (!isSeasonActive) {
    return (
      <div className="p-8 text-center">
        <div className="text-6xl mb-4">🥭</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Mango Season is Currently Closed</h2>
        <p className="text-gray-600">Please check back during the mango season.</p>
      </div>
    );
  }

  const stepLabels = ['Depot & Payment', 'Sender Details', 'Receivers & Packages', 'Summary'];

  // Check for pending booking that completed
  const completedPendingBooking = pendingBookingId
    ? pendingOperations.find(op => op.id === pendingBookingId && op.status === 'completed')
    : null;

  return (
    <div className="p-8">
      {/* Draft Recovery Prompt */}
      {showDraftPrompt && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">📝</span>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">Resume Previous Booking?</h3>
              <p className="text-sm text-blue-700 mt-1">
                You have an unsaved booking from {lastSavedAt ? new Date(lastSavedAt).toLocaleString() : 'earlier'}.
                Would you like to continue where you left off?
              </p>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={restoreDraft}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Resume Booking
                </button>
                <button
                  onClick={dismissDraft}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  Start Fresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offline Warning */}
      {!isOnline && currentStep < 5 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <span className="font-medium text-amber-800">You're currently offline. </span>
              <span className="text-amber-700">Your booking will be saved and submitted when you're back online.</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">New Booking</h1>
        <p className="text-gray-600">Create a new mango transport booking</p>
      </div>

      {/* Step Indicator with Swipe Navigation */}
      {currentStep <= 4 && (
        <div className="mb-8">
          {/* Mobile Navigation Arrows */}
          <div className="flex items-center justify-center gap-4 mb-4 lg:hidden">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className={`p-3 rounded-full transition-colors touch-target ${currentStep === 1
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : 'bg-orange-100 text-orange-600 hover:bg-orange-200 active:bg-orange-300'
                }`}
              aria-label="Previous step"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">Step {currentStep} of 4</div>
              <div className="text-sm text-gray-600">{stepLabels[currentStep - 1]}</div>
            </div>

            <button
              onClick={nextStep}
              disabled={currentStep === 4}
              className={`p-3 rounded-full transition-colors touch-target ${currentStep === 4
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                : 'bg-orange-100 text-orange-600 hover:bg-orange-200 active:bg-orange-300'
                }`}
              aria-label="Next step"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Desktop Step Indicator */}
          <div className="hidden lg:flex items-center justify-center gap-2">
            {stepLabels.map((label, index) => (
              <React.Fragment key={index}>
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${currentStep === index + 1
                    ? 'bg-orange-500 text-white'
                    : currentStep > index + 1
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                    }`}
                >
                  <span>{index + 1}</span>
                  <span>{label}</span>
                </div>
                {index < 3 && <div className="w-8 h-0.5 bg-gray-200" />}
              </React.Fragment>
            ))}
          </div>

          {/* Swipe hint for mobile */}
          <p className="lg:hidden text-center text-xs text-gray-400 mt-2">
            Swipe or use arrows to navigate
          </p>
        </div>
      )}

      {/* Form Steps - Swipe enabled on mobile */}
      <div
        className="bg-white rounded-xl border border-gray-200 p-8 max-w-4xl mx-auto"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {currentStep === 1 && (
          <Step1DepotPaymentDelivery
            formData={formData}
            setFormData={setFormData}
            depots={depots}
            onNext={nextStep}
          />
        )}

        {currentStep === 2 && (
          <Step2SenderDetails
            formData={formData}
            setFormData={setFormData}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}

        {currentStep === 3 && (
          <Step3ReceiversPackages
            formData={formData}
            setFormData={setFormData}
            packages={packages}
            pricing={pricing}
            onNext={nextStep}
            onPrev={prevStep}
          />
        )}

        {currentStep === 4 && (
          <Step4Summary
            formData={formData}
            depots={depots}
            onSubmit={handleSubmit}
            onPrev={prevStep}
            goToStep={goToStep}
            isSubmitting={isSubmitting}
          />
        )}

        {currentStep === 5 && (
          <Step5Confirmation
            receiptNumber={receiptNumber}
            formData={formData}
            depots={depots}
            onNewBooking={resetForm}
            onNavigate={onNavigate}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 1: Depot, Payment & Delivery
// ============================================================================
function Step1DepotPaymentDelivery({ formData, setFormData, depots, onNext }: any) {
  // Origin depots: only show depots with type "origin"
  const originDepots = depots.filter((d: any) => d.type === 'origin');

  // Destination depots: exclude origin-type depots (Devgad, Shirgaon)
  const destinationDepots = depots.filter((d: any) => d.type !== 'origin');

  // Sort destinations: Bhusari Colony, Sadashiv Peth, Akurdi first (managed depots)
  const sortedDestinations = destinationDepots
    .sort((a: any, b: any) => {
      const priority = ['bhusari colony', 'sadashiv peth', 'akurdi'];
      const aIndex = priority.indexOf(a.name?.toLowerCase());
      const bIndex = priority.indexOf(b.name?.toLowerCase());
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

  const canProceed = formData.originDepotId && formData.destinationDepotId && formData.paymentMethod;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Step 1: Route & Payment</h2>

      {/* Depot Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Origin Depot *</label>
          <select
            value={formData.originDepotId}
            onChange={(e) => setFormData({ ...formData, originDepotId: e.target.value, destinationDepotId: '' })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          >
            <option value="">Select Origin</option>
            {originDepots.map((depot: any) => (
              <option key={depot.id} value={depot.id}>{depot.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Destination Depot *</label>
          <select
            value={formData.destinationDepotId}
            onChange={(e) => setFormData({ ...formData, destinationDepotId: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            disabled={!formData.originDepotId}
          >
            <option value="">Select Destination</option>
            {sortedDestinations.map((depot: any) => (
              <option key={depot.id} value={depot.id}>{depot.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Payment Method */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Payment Method *</label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: 'cash', label: '💵 Cash' },
            { value: 'online', label: '📱 Online' },
            { value: 'to_pay', label: '📦 To Pay' },
            { value: 'credit', label: '💳 Credit' }
          ].map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData({ ...formData, paymentMethod: option.value })}
              className={`px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all ${formData.paymentMethod === option.value
                ? 'border-orange-500 bg-orange-50 text-orange-700'
                : 'border-gray-200 hover:border-orange-300'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-3">Delivery Type *</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'pickup', label: '🏪 Depot Pickup', desc: 'Receiver picks up from depot' },
            { value: 'home_sender', label: '🏠 Home Delivery (Paid)', desc: 'Delivery paid by sender' },
            { value: 'home_topay', label: '🚚 Home Delivery (To Pay)', desc: 'Delivery paid by receiver' },
            { value: 'home_drt', label: '📍 DRT Delivery', desc: 'Special DRT delivery' }
          ].map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData({ ...formData, deliveryType: option.value, deliveryCharge: 0 })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${formData.deliveryType === option.value
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-orange-300'
                }`}
            >
              <div className="font-medium">{option.label}</div>
              <div className="text-xs text-gray-500 mt-1">{option.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Delivery Charge (if home delivery) */}
      {formData.deliveryType !== 'pickup' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Charge (₹)</label>
          <input
            type="number"
            min="0"
            value={formData.deliveryCharge}
            onChange={(e) => setFormData({ ...formData, deliveryCharge: Number(e.target.value) })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="Enter delivery charge"
          />
        </div>
      )}

      {/* Custom Instructions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Special Instructions (Optional)</label>
        <textarea
          value={formData.customInstructions}
          onChange={(e) => setFormData({ ...formData, customInstructions: e.target.value })}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
          rows={2}
          placeholder="Any special handling instructions..."
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
        >
          Next Step →
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 2: Sender Details
// ============================================================================
function Step2SenderDetails({ formData, setFormData, onNext, onPrev }: any) {
  const validatePhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);
  const canProceed = formData.senderName && validatePhone(formData.senderPhone);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Step 2: Sender Details</h2>
      <p className="text-gray-600">Start typing to see suggestions from past bookings</p>

      <ContactAutocomplete
        nameValue={formData.senderName}
        phoneValue={formData.senderPhone}
        onNameChange={(value) => setFormData({ ...formData, senderName: value })}
        onPhoneChange={(value) => setFormData({ ...formData, senderPhone: value })}
        onContactSelect={(contact) => setFormData({ ...formData, senderName: contact.name, senderPhone: contact.phone })}
        nameLabel="Sender Name"
        phoneLabel="Sender Phone"
        namePlaceholder="Start typing name..."
        phonePlaceholder="10-digit number"
        required
      />

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
        >
          ← Previous
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
        >
          Next Step →
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3: Receivers & Packages
// ============================================================================
function Step3ReceiversPackages({ formData, setFormData, packages, pricing, onNext, onPrev }: any) {
  const validatePhone = (phone: string) => /^[6-9]\d{9}$/.test(phone);
  const requiresAddress = ['home_sender', 'home_topay', 'home_drt'].includes(formData.deliveryType);

  const getPackagePrice = (packageId: string) => {
    const priceEntry = pricing.find(
      (p: any) => p.packageId === packageId && p.depotId === formData.destinationDepotId
    );
    return priceEntry?.price || packages.find((p: any) => p.id === packageId)?.basePrice || 0;
  };

  // Sort packages: 1Dz first
  const sortedPackages = [...packages].sort((a: any, b: any) => {
    const priority = ['1 dz', '1dz', '2 dz', '2dz', '3 dz', '3dz', '5 dz', '5dz'];
    const aName = a.name?.toLowerCase() || '';
    const bName = b.name?.toLowerCase() || '';
    const aIndex = priority.findIndex(p => aName.includes(p));
    const bIndex = priority.findIndex(p => bName.includes(p));
    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
    if (aIndex !== -1) return -1;
    if (bIndex !== -1) return 1;
    return aName.localeCompare(bName);
  });

  const updateReceiver = (index: number, field: string, value: any) => {
    const newReceivers = [...formData.receivers];
    newReceivers[index] = { ...newReceivers[index], [field]: value };
    setFormData({ ...formData, receivers: newReceivers });
  };

  const updateReceiverPackage = (receiverIndex: number, packageId: string, quantity: number) => {
    const newReceivers = [...formData.receivers];
    const receiver = newReceivers[receiverIndex];
    const pkg = packages.find((p: any) => p.id === packageId);
    const price = getPackagePrice(packageId);

    const existingIndex = receiver.packages.findIndex((p: any) => p.packageId === packageId);

    if (quantity > 0) {
      const pkgData = { packageId, size: pkg?.name || 'Custom', quantity, price };
      if (existingIndex >= 0) {
        receiver.packages[existingIndex] = pkgData;
      } else {
        receiver.packages.push(pkgData);
      }
    } else if (existingIndex >= 0) {
      receiver.packages.splice(existingIndex, 1);
    }

    setFormData({ ...formData, receivers: newReceivers });
  };

  // Update description for Other package
  const updateReceiverPackageDescription = (receiverIndex: number, packageId: string, description: string) => {
    const newReceivers = [...formData.receivers];
    const receiver = newReceivers[receiverIndex];
    const existingIndex = receiver.packages.findIndex((p: any) => p.packageId === packageId);
    if (existingIndex >= 0) {
      receiver.packages[existingIndex].description = description;
      setFormData({ ...formData, receivers: newReceivers });
    }
  };

  const getReceiverPackageDescription = (receiverIndex: number, packageId: string) => {
    const pkg = formData.receivers[receiverIndex]?.packages?.find((p: any) => p.packageId === packageId);
    return pkg?.description || '';
  };

  const isOtherPackage = (pkgName: string) => {
    return pkgName?.toLowerCase() === 'other';
  };

  const getReceiverPackageQuantity = (receiverIndex: number, packageId: string) => {
    const pkg = formData.receivers[receiverIndex]?.packages?.find((p: any) => p.packageId === packageId);
    return pkg?.quantity || 0;
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

  const getReceiverSubtotal = (receiver: Receiver) => {
    return receiver.packages.reduce((sum, pkg) => sum + (pkg.quantity * pkg.price), 0);
  };

  const canProceed = formData.receivers.every((r: Receiver) =>
    r.name && validatePhone(r.phone) && r.packages.length > 0 && (!requiresAddress || r.address)
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Step 3: Receivers & Packages</h2>
      <p className="text-gray-600">Add receiver details and select packages for each receiver</p>

      {formData.receivers.map((receiver: Receiver, receiverIndex: number) => (
        <div key={receiverIndex} className="p-6 border-2 border-gray-200 rounded-lg space-y-4 bg-gray-50">
          <div className="flex justify-between items-center pb-2 border-b">
            <h3 className="text-lg font-bold text-gray-900">Receiver {receiverIndex + 1}</h3>
            {formData.receivers.length > 1 && (
              <button
                onClick={() => removeReceiver(receiverIndex)}
                className="text-red-600 hover:text-red-700 text-sm font-medium"
              >
                Remove
              </button>
            )}
          </div>

          {/* Receiver Contact with Autocomplete */}
          <ContactAutocomplete
            nameValue={receiver.name}
            phoneValue={receiver.phone}
            onNameChange={(value) => updateReceiver(receiverIndex, 'name', value)}
            onPhoneChange={(value) => updateReceiver(receiverIndex, 'phone', value)}
            onContactSelect={(contact) => {
              const newReceivers = [...formData.receivers];
              newReceivers[receiverIndex] = {
                ...newReceivers[receiverIndex],
                name: contact.name,
                phone: contact.phone
              };
              setFormData({ ...formData, receivers: newReceivers });
            }}
            nameLabel="Receiver Name"
            phoneLabel="Receiver Phone"
            namePlaceholder="Start typing name..."
            phonePlaceholder="10-digit number"
            required
          />

          {/* Address (if required) */}
          {requiresAddress && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address *</label>
              <textarea
                value={receiver.address}
                onChange={(e) => updateReceiver(receiverIndex, 'address', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                rows={2}
                placeholder="Enter full delivery address"
                required
              />
            </div>
          )}

          {/* Packages - 3x3 Grid */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">📦 Select Packages</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sortedPackages.map((pkg: any) => {
                const price = getPackagePrice(pkg.id);
                const quantity = getReceiverPackageQuantity(receiverIndex, pkg.id);
                const isOther = isOtherPackage(pkg.name);
                const description = getReceiverPackageDescription(receiverIndex, pkg.id);
                return (
                  <div key={pkg.id} className={`p-3 bg-white border rounded-lg hover:border-orange-300 transition-colors ${isOther && quantity > 0 ? 'border-yellow-400 col-span-full' : 'border-gray-200'}`}>
                    <div className="font-medium text-gray-900 text-sm">{pkg.name}</div>
                    <div className="text-xs text-gray-600 mb-2">₹{price}/unit</div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={quantity > 0 ? quantity : ''}
                        placeholder="0"
                        onChange={(e) => updateReceiverPackage(receiverIndex, pkg.id, Number(e.target.value) || 0)}
                        className={`w-16 px-2 py-1 text-center border rounded focus:ring-2 focus:ring-orange-500 ${quantity > 0 ? 'border-orange-400 bg-orange-50' : 'border-gray-300 text-gray-400'
                          }`}
                      />
                      {quantity > 0 && (
                        <span className="text-xs font-medium text-green-600">
                          ₹{(quantity * price).toFixed(0)}
                        </span>
                      )}
                    </div>
                    {/* Description field for Other package */}
                    {isOther && quantity > 0 && (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={description}
                          onChange={(e) => updateReceiverPackageDescription(receiverIndex, pkg.id, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-sm"
                          placeholder="Enter description (e.g., Special box, Custom crate...)"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Receiver Subtotal */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex justify-between items-center">
              <span className="font-medium">Subtotal for {receiver.name || `Receiver ${receiverIndex + 1}`}:</span>
              <span className="text-lg font-bold text-orange-600">₹{getReceiverSubtotal(receiver).toFixed(2)}</span>
            </div>
          </div>
        </div>
      ))}

      <button
        onClick={addReceiver}
        className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-orange-500 hover:text-orange-500 font-medium transition-colors"
      >
        + Add Another Receiver
      </button>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
        >
          ← Previous
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-8 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 font-medium"
        >
          Review Summary →
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 4: Summary
// ============================================================================
function Step4Summary({ formData, depots, onSubmit, onPrev, goToStep, isSubmitting }: any) {
  const originDepot = depots.find((d: any) => d.id === formData.originDepotId);
  const destinationDepot = depots.find((d: any) => d.id === formData.destinationDepotId);

  const packagesTotal = formData.receivers.reduce((sum: number, receiver: any) => {
    return sum + receiver.packages.reduce((rSum: number, pkg: any) => rSum + (pkg.quantity * pkg.price), 0);
  }, 0);
  const grandTotal = packagesTotal + (formData.deliveryCharge || 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Step 4: Review & Confirm</h2>

      {/* Route */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-900">📍 Route</h3>
          <button onClick={() => goToStep(1)} className="text-orange-600 text-sm hover:underline">Edit</button>
        </div>
        <p>{originDepot?.name} → {destinationDepot?.name}</p>
        <p className="text-sm text-gray-600">Payment: {formData.paymentMethod?.toUpperCase()} | Delivery: {formData.deliveryType?.replace('_', ' ')}</p>
      </div>

      {/* Sender */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-900">👤 Sender</h3>
          <button onClick={() => goToStep(2)} className="text-orange-600 text-sm hover:underline">Edit</button>
        </div>
        <p>{formData.senderName} ({formData.senderPhone})</p>
      </div>

      {/* Receivers & Packages */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-gray-900">📦 Receivers & Packages</h3>
          <button onClick={() => goToStep(3)} className="text-orange-600 text-sm hover:underline">Edit</button>
        </div>
        {formData.receivers.map((receiver: any, index: number) => (
          <div key={index} className="border-l-4 border-orange-300 pl-4 mb-4">
            <p className="font-medium">{receiver.name} ({receiver.phone})</p>
            {receiver.address && <p className="text-sm text-gray-600">{receiver.address}</p>}
            <div className="mt-2 space-y-1">
              {receiver.packages.map((pkg: any, pkgIndex: number) => (
                <div key={pkgIndex} className="flex justify-between text-sm">
                  <span>{pkg.size} × {pkg.quantity}</span>
                  <span>₹{(pkg.quantity * pkg.price).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Total */}
      <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
        <div className="flex justify-between text-sm mb-1">
          <span>Packages Subtotal</span>
          <span>₹{packagesTotal.toFixed(2)}</span>
        </div>
        {formData.deliveryCharge > 0 && (
          <div className="flex justify-between text-sm mb-1">
            <span>Delivery Charge</span>
            <span>₹{formData.deliveryCharge.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t border-orange-300">
          <span>Total Amount</span>
          <span className="text-orange-600">₹{grandTotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
        >
          ← Previous
        </button>
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {isSubmitting ? 'Creating...' : '✓ Confirm Booking'}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 5: Confirmation with PDF, WhatsApp, New Booking
// ============================================================================
function Step5Confirmation({ receiptNumber, formData, depots, onNewBooking, onNavigate }: any) {
  const originDepot = depots?.find((d: any) => d.id === formData?.originDepotId);
  const destinationDepot = depots?.find((d: any) => d.id === formData?.destinationDepotId);

  // Check if this is a pending (offline) booking
  const isPending = receiptNumber?.startsWith('PENDING-');
  const pendingOperations = useSyncStore((state) => state.pendingOperations);
  const isOnline = useOnlineStore((state) => state.isOnline);

  // Find the pending operation to check its status
  const pendingOpId = isPending ? receiptNumber.replace('PENDING-', '').toLowerCase() : null;
  const pendingOp = pendingOpId
    ? pendingOperations.find(op => op.id.toLowerCase().endsWith(pendingOpId))
    : null;

  const calculateTotal = () => {
    if (!formData?.receivers) return 0;
    return formData.receivers.reduce((sum: number, receiver: any) => {
      return sum + (receiver.packages || []).reduce((rSum: number, pkg: any) => rSum + (pkg.quantity * pkg.price), 0);
    }, 0) + (formData.deliveryCharge || 0);
  };

  const generateReceiptText = () => {
    const lines = [
      `🥭 DRT MANGO TRANSPORT`,
      `━━━━━━━━━━━━━━━━━━━━━━`,
      `Receipt: ${receiptNumber}`,
      `Date: ${new Date().toLocaleDateString('en-IN')}`,
      ``,
      `📍 DESTINATION`,
      `${destinationDepot?.name || 'N/A'}`,
      ``,
      `👤 SENDER`,
      `*${formData?.senderName || 'N/A'}* (${formData?.senderPhone || 'N/A'})`,
      ``,
      `📦 RECEIVERS & PACKAGES`,
    ];

    formData?.receivers?.forEach((receiver: any, i: number) => {
      lines.push(`\n${i + 1}. ${receiver.name} (${receiver.phone})`);
      receiver.packages?.forEach((pkg: any) => {
        lines.push(`   • ${pkg.size} × ${pkg.quantity} = ₹${(pkg.quantity * pkg.price).toFixed(0)}`);
      });
    });

    lines.push(`\n━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`💰 TOTAL: ₹${calculateTotal().toFixed(2)}`);
    lines.push(`\nThank you for choosing DRT Mango Transport! 🥭`);

    return lines.join('\n');
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(generateReceiptText());
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleDownloadPDF = async () => {
    // Dynamically import jsPDF to reduce initial bundle size (~693KB saved)
    const { jsPDF } = await import('jspdf');
    // A5 size landscape: 210mm x 148mm
    const doc = new jsPDF({ format: 'a5', unit: 'mm', orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = 15;

    // ============ HEADER ============
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('DRT MANGO TRANSPORT', pageWidth / 2, y, { align: 'center' });
    y += 6;

    // Address line
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('AT POST JAMSANDE, TAL.DEVGAD, DIST. SINDHUDURG MOB: 9422584166, 9422435348', pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Receipt Number label
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Receipt Number', pageWidth / 2, y, { align: 'center' });
    y += 5;

    // Receipt Number value
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(receiptNumber, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // ============ DESTINATION & DATE (no table borders) ============
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Destination: ${destinationDepot?.name || 'N/A'}`, margin, y);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - margin, y, { align: 'right' });
    y += 8;

    // ============ SENDER ============
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Sender: ${formData?.senderName || 'N/A'} (${formData?.senderPhone || 'N/A'})`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    // ============ RECEIVERS & PACKAGES ============
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('RECEIVERS & PACKAGES', margin, y);
    y += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    // Calculate center position for receivers list
    const receiverStartX = margin + 30;
    const packagesX = pageWidth - margin - 10;
    const maxY = pageHeight - 40; // Leave space for total and footer

    formData?.receivers?.forEach((receiver: any, i: number) => {
      // Check if we need a new page before adding receiver
      if (y > maxY) {
        doc.addPage();
        y = 15;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
      }

      // Receiver name and phone
      const receiverText = `${i + 1}. ${receiver.name?.toUpperCase() || 'N/A'} (${receiver.phone || 'N/A'})`;
      doc.text(receiverText, receiverStartX, y);
      y += 6;

      // Each package on its own line, right-aligned to match TOTAL
      if (receiver.packages && receiver.packages.length > 0) {
        doc.setFontSize(9);
        receiver.packages.forEach((pkg: any) => {
          // Check for page overflow before each package
          if (y > maxY) {
            doc.addPage();
            y = 15;
            doc.setFontSize(9);
          }
          const pkgText = `${pkg.size} × ${pkg.quantity} = ₹${(pkg.quantity * pkg.price).toFixed(0)}`;
          doc.text(pkgText, pageWidth - margin - 10, y, { align: 'right' });
          y += 5;
        });
        doc.setFontSize(10);
      }

      // Add address if home delivery (on next line, smaller)
      if (receiver.address) {
        if (y > maxY) {
          doc.addPage();
          y = 15;
        }
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Address: ${receiver.address}`, receiverStartX + 10, y);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        y += 6;
      }
      y += 3; // Extra spacing between receivers
    });

    y += 5;

    // ============ TOTAL ============
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`TOTAL: ₹${calculateTotal().toFixed(2)}`, pageWidth - margin, y, { align: 'right' });
    y += 6;

    // Payment Method
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const paymentMethodText = formData?.paymentMethod?.replace('_', ' ')?.toUpperCase() || 'CASH';
    doc.text(`(${paymentMethodText})`, pageWidth - margin, y, { align: 'right' });
    y += 12;

    // ============ THANK YOU MESSAGE ============
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('THANK YOU FOR USING OUR SERVICES', pageWidth / 2, y, { align: 'center' });
    y += 15;

    // ============ SIGNATURE LINE ============
    const signLineWidth = 40;
    const signLineX = pageWidth - margin - signLineWidth;
    doc.setLineWidth(0.5);
    doc.line(signLineX, y, signLineX + signLineWidth, y);
    y += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('SIGN', signLineX + signLineWidth / 2, y, { align: 'center' });

    doc.save(`${receiptNumber}.pdf`);
  };

  const handleCopyReceipt = () => {
    navigator.clipboard.writeText(receiptNumber);
    alert('Receipt number copied!');
  };

  const handleGoToDashboard = () => {
    if (onNavigate) {
      onNavigate('dashboard');
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="text-center space-y-6 py-8">
      {/* Different display for pending vs confirmed bookings */}
      {isPending ? (
        <>
          <div className="text-6xl">{pendingOp?.status === 'syncing' ? '🔄' : pendingOp?.status === 'failed' ? '⚠️' : '⏳'}</div>
          <h2 className="text-3xl font-bold text-gray-900">
            {pendingOp?.status === 'syncing' ? 'Syncing Booking...' :
              pendingOp?.status === 'failed' ? 'Sync Failed' :
                'Booking Saved Locally'}
          </h2>
          <p className="text-gray-600">
            {isOnline
              ? pendingOp?.status === 'failed'
                ? 'Failed to sync. Will retry automatically or you can retry from the status bar.'
                : 'Your booking will be synced shortly...'
              : 'Your booking is saved and will be submitted when you\'re back online.'}
          </p>

          <div className={`border rounded-lg p-6 max-w-md mx-auto ${pendingOp?.status === 'failed' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
            }`}>
            <p className="text-sm text-gray-600 mb-2">Temporary Reference</p>
            <p className={`text-2xl font-bold ${pendingOp?.status === 'failed' ? 'text-red-700' : 'text-amber-700'}`}>
              {receiptNumber}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {pendingOp?.status === 'syncing' && '⏳ Syncing now...'}
              {pendingOp?.status === 'pending' && isOnline && '⏳ Waiting to sync...'}
              {pendingOp?.status === 'pending' && !isOnline && '📴 Will sync when online'}
              {pendingOp?.status === 'failed' && `❌ ${pendingOp.error || 'Sync failed'}`}
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="text-6xl">✅</div>
          <h2 className="text-3xl font-bold text-gray-900">Booking Created Successfully!</h2>
          <p className="text-gray-600">Your mango transport booking has been confirmed</p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-6 max-w-md mx-auto">
            <p className="text-sm text-gray-600 mb-2">Receipt Number</p>
            <p className="text-3xl font-bold text-green-700">{receiptNumber}</p>
            <button onClick={handleCopyReceipt} className="mt-2 text-sm text-green-600 hover:underline">
              📋 Copy
            </button>
          </div>
        </>
      )}

      <div className="bg-gray-50 border rounded-lg p-4 max-w-md mx-auto text-left">
        <div className="flex justify-between text-sm mb-1">
          <span>Route:</span>
          <span className="font-medium">{originDepot?.name} → {destinationDepot?.name}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span>Sender:</span>
          <span className="font-medium">{formData?.senderName}</span>
        </div>
        <div className="flex justify-between font-bold pt-2 border-t mt-2">
          <span>Total:</span>
          <span className={isPending ? "text-amber-700" : "text-green-700"}>₹{calculateTotal().toFixed(2)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3 max-w-md mx-auto pt-4">
        {!isPending && (
          <div className="flex gap-3">
            <button onClick={handleWhatsAppShare} className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium">
              💬 WhatsApp
            </button>
            <button onClick={handleDownloadPDF} className="flex-1 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium">
              📥 Download PDF
            </button>
          </div>
        )}
        {isPending && (
          <div className="p-3 bg-gray-100 rounded-lg text-sm text-gray-600">
            📋 Share and PDF options will be available after sync completes
          </div>
        )}
        <button onClick={onNewBooking} className="py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium">
          ➕ Create New Booking
        </button>
        <button onClick={handleGoToDashboard} className="py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">
          🏠 Go to Dashboard
        </button>
      </div>
    </div>
  );
}