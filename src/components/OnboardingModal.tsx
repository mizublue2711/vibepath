import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../context/LanguageContext';
import { Rocket, Search, Star, Film, Gamepad2, X } from 'lucide-react';

export interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTryNow?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onTryNow,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleTryNow = () => {
    if (onTryNow) {
      onTryNow();
    }
    onClose();
  };

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-guide-title"
      className="fixed inset-0 z-50 bg-[#080A0F]/90 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 rounded-none select-none"
    >
      <div className="bg-[#0D1017] border border-[#00E5FF] shadow-[0_0_24px_rgba(0,229,255,0.35)] w-full max-w-xl p-4 sm:p-6 text-[#F3F6F9] font-mono-brand flex flex-col gap-4 max-h-[90vh] overflow-y-auto rounded-none">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#1F1F2E] pb-3 rounded-none">
          <div className="flex items-center gap-2 text-[#00E5FF]">
            <Rocket className="w-4 h-4 shrink-0 text-[#00E5FF]" />
            <h2
              id="onboarding-guide-title"
              className="font-mono text-sm sm:text-base font-bold tracking-wider uppercase text-[#00E5FF]"
            >
              {t('onboarding.title')}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close guide modal"
            className="min-h-[34px] px-3 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#FF5252] text-[#8A8FA3] hover:text-white font-mono text-xs font-bold cursor-pointer transition-colors rounded-none"
          >
            <span className="flex items-center gap-1">
              <X className="w-3.5 h-3.5 shrink-0" />
              <span>{t('onboarding.close')}</span>
            </span>
          </button>
        </div>

        {/* 3-Step Guide List */}
        <div className="flex flex-col gap-3 py-1">
          {/* Step 1 */}
          <div className="bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF]/60 p-3.5 flex items-start gap-3 transition-colors rounded-none">
            <div className="p-2 bg-[#0D1017] border border-[#00E5FF] text-[#00E5FF] shrink-0 rounded-none">
              <Search className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[#00E5FF] font-mono tracking-widest font-bold">
                [ 01 // DISCOVERY ]
              </span>
              <p className="text-xs sm:text-sm font-mono font-semibold text-[#F3F6F9] leading-relaxed">
                {t('onboarding.step1')}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF]/60 p-3.5 flex items-start gap-3 transition-colors rounded-none">
            <div className="p-2 bg-[#0D1017] border border-[#00FF66] text-[#00FF66] shrink-0 rounded-none">
              <Star className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[#00FF66] font-mono tracking-widest font-bold">
                [ 02 // SENSORY_DATA ]
              </span>
              <p className="text-xs sm:text-sm font-mono font-semibold text-[#F3F6F9] leading-relaxed">
                {t('onboarding.step2')}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF]/60 p-3.5 flex items-start gap-3 transition-colors rounded-none">
            <div className="p-2 bg-[#0D1017] border border-[#5322FF] text-[#00E5FF] shrink-0 rounded-none">
              <Film className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-[#5322FF] font-mono tracking-widest font-bold">
                [ 03 // 3D_RENDER ]
              </span>
              <p className="text-xs sm:text-sm font-mono font-semibold text-[#F3F6F9] leading-relaxed">
                {t('onboarding.step3')}
              </p>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="border-t border-[#1F1F2E] pt-3 flex flex-wrap items-center justify-between gap-2.5 rounded-none">
          <span className="text-[11px] font-mono text-[#8A8FA3]">
            [ CYBERNETIC_SWISS_BRUTALISM // HUD_V1 ]
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[38px] px-3.5 bg-[#080A0F] border border-[#1F1F2E] hover:border-[#00E5FF] text-[#8A8FA3] hover:text-white font-mono text-xs font-bold cursor-pointer transition-colors rounded-none"
            >
              {t('onboarding.close')}
            </button>

            <button
              type="button"
              onClick={handleTryNow}
              className="min-h-[38px] px-4 bg-[#00E5FF] hover:bg-[#00E5FF]/90 border border-[#00E5FF] text-[#080A0F] font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-colors shadow-[0_0_12px_rgba(0,229,255,0.4)] rounded-none"
            >
              <Gamepad2 className="w-4 h-4 shrink-0" />
              <span>{t('onboarding.tryNow')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
