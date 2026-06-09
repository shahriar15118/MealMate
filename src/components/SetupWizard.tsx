import React, { useState } from 'react';
import { addMemberInDb } from '../firebase';
import { UserPlus, Sparkles, Loader2, Play } from 'lucide-react';

interface SetupWizardProps {
  onComplete: () => void;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export default function SetupWizard({ onComplete, showToast }: SetupWizardProps) {
  const [members, setMembers] = useState([
    { name: 'Tanvir Rahman', phone: '01712345678' },
    { name: 'Sajid Islam', phone: '01812345679' },
    { name: 'Asif Ur Rahman', phone: '01912345680' },
  ]);
  const [loading, setLoading] = useState(false);

  const handleFieldChange = (index: number, field: 'name' | 'phone', value: string) => {
    const updated = [...members];
    updated[index][field] = value;
    setMembers(updated);
  };

  const addFieldRow = () => {
    if (members.length >= 5) {
      showToast('warning', 'You can seed a maximum of 5 initial members.');
      return;
    }
    setMembers([...members, { name: '', phone: '' }]);
  };

  const removeFieldRow = (index: number) => {
    if (members.length <= 2) {
      showToast('warning', 'Please provide at least 2 initial members to set up the household.');
      return;
    }
    const updated = members.filter((_, i) => i !== index);
    setMembers(updated);
  };

  const handleSeed = async (e: React.FormEvent) => {
    e.preventDefault();
    // Validate
    const invalid = members.some((m) => !m.name.trim() || !m.phone.trim());
    if (invalid) {
      showToast('warning', 'Please fill in all names and phone numbers.');
      return;
    }

    setLoading(false);
    try {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];
      for (const m of members) {
        await addMemberInDb(m.name.trim(), m.phone.trim(), todayStr);
      }
      showToast('success', `${members.length} members successfully added! App is initialized.`);
      onComplete();
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to seed initial members. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F1117]/80 backdrop-blur-md">
      <div 
        id="setup-wizard-modal"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-[#1A1D2E] border border-[#2D3142]/80 shadow-2xl transition-all"
      >
        <div className="p-6 bg-gradient-to-r from-[#6C63FF]/20 via-[#1A1D2E] to-[#1A1D2E] border-b border-[#2D3142]/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#6C63FF]/20 text-[#6C63FF]">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="font-sans text-xl font-bold text-[#E8E9F3] tracking-tight">Welcome to MealMate</h2>
              <p className="text-xs text-[#6B7280]">Initialize your bachelor household tracker</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSeed} className="p-6 space-y-4">
          <div className="text-sm text-[#6B7280]">
            Database is currently empty. Setting up initial members lets you immediately start tracking daily food and shared ledger costs. Provide 2 to 5 members below:
          </div>

          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 scrollbar-thin">
            {members.map((member, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="font-mono text-xs text-[#6B7280] w-6 text-right">#{index + 1}</span>
                <input
                  id={`init-member-name-${index}`}
                  type="text"
                  placeholder="Full Name (e.g. Sajid)"
                  aria-label={`Init Member Name ${index}`}
                  value={member.name}
                  onChange={(e) => handleFieldChange(index, 'name', e.target.value)}
                  className="flex-1 min-w-0 bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                  required
                />
                <input
                  id={`init-member-phone-${index}`}
                  type="text"
                  placeholder="Phone"
                  aria-label={`Init Member Phone ${index}`}
                  value={member.phone}
                  onChange={(e) => handleFieldChange(index, 'phone', e.target.value)}
                  className="w-1/3 bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                  required
                />
                {members.length > 2 && (
                  <button
                    id={`remove-init-row-btn-${index}`}
                    type="button"
                    onClick={() => removeFieldRow(index)}
                    className="p-2 text-xs text-[#FF6B6B] hover:bg-[#FF6B6B]/15 rounded-md"
                    title="Remove member row"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              id="setup-add-row-btn"
              type="button"
              onClick={addFieldRow}
              disabled={members.length >= 5}
              className="flex items-center gap-1 text-xs text-[#6C63FF] hover:text-[#818CF8]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              + Add Another Roommate
            </button>
            <span className="text-xs font-mono text-[#6B7280]">{members.length}/5 members</span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[#2D3142]/40">
            <button
              id="setup-skip-btn"
              type="button"
              onClick={onComplete}
              className="px-4 py-2 hover:bg-[#2D3142]/40 text-xs text-[#6B7280] rounded-lg"
            >
              Configure Later (Empty State)
            </button>
            <button
              id="setup-submit-btn"
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#6C63FF] hover:bg-[#5b54e7] text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating Household...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Launch MealMate App
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
