import React, { useState, useEffect, useRef } from 'react';
import { contactsApi } from '../utils/api';

interface Contact {
    id: string;
    name: string;
    phone: string;
    usage_count: number;
}

interface ContactAutocompleteProps {
    nameValue: string;
    phoneValue: string;
    onNameChange: (value: string) => void;
    onPhoneChange: (value: string) => void;
    onContactSelect?: (contact: Contact) => void;
    nameLabel?: string;
    phoneLabel?: string;
    namePlaceholder?: string;
    phonePlaceholder?: string;
    required?: boolean;
}

export default function ContactAutocomplete({
    nameValue,
    phoneValue,
    onNameChange,
    onPhoneChange,
    onContactSelect,
    nameLabel = 'Name',
    phoneLabel = 'Phone',
    namePlaceholder = 'Enter name',
    phonePlaceholder = '10-digit number',
    required = false
}: ContactAutocompleteProps) {
    const [suggestions, setSuggestions] = useState<Contact[]>([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [activeField, setActiveField] = useState<'name' | 'phone' | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Debounce search
    useEffect(() => {
        const query = activeField === 'name' ? nameValue : phoneValue;
        if (!query || query.length < 2) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            const { contacts } = await contactsApi.search(query);
            setSuggestions(contacts);
            setShowDropdown(contacts.length > 0);
            setIsLoading(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [nameValue, phoneValue, activeField]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectContact = (contact: Contact) => {
        onNameChange(contact.name);
        onPhoneChange(contact.phone);
        setShowDropdown(false);
        if (onContactSelect) onContactSelect(contact);
    };

    const validatePhone = (phone: string) => {
        return /^[6-9]\d{9}$/.test(phone);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name Field */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {nameLabel} {required && '*'}
                    </label>
                    <input
                        type="text"
                        value={nameValue}
                        onChange={(e) => onNameChange(e.target.value)}
                        onFocus={() => setActiveField('name')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder={namePlaceholder}
                        autoComplete="off"
                        required={required}
                    />
                </div>

                {/* Phone Field */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {phoneLabel} {required && '*'}
                    </label>
                    <input
                        type="tel"
                        value={phoneValue}
                        onChange={(e) => onPhoneChange(e.target.value)}
                        onFocus={() => setActiveField('phone')}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        placeholder={phonePlaceholder}
                        maxLength={10}
                        autoComplete="off"
                        required={required}
                    />
                    {phoneValue && !validatePhone(phoneValue) && (
                        <p className="mt-1 text-sm text-red-600">
                            Must be 10 digits starting with 9, 8, 7, or 6
                        </p>
                    )}
                </div>
            </div>

            {/* Suggestions Dropdown */}
            {showDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {isLoading ? (
                        <div className="p-3 text-gray-500 text-center">Searching...</div>
                    ) : (
                        suggestions.map((contact) => (
                            <button
                                key={contact.id}
                                type="button"
                                onClick={() => handleSelectContact(contact)}
                                className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b border-gray-100 last:border-0 transition-colors"
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <div className="font-medium text-gray-900">{contact.name}</div>
                                        <div className="text-sm text-gray-600">{contact.phone}</div>
                                    </div>
                                    <div className="text-xs text-gray-400">
                                        Used {contact.usage_count}x
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
