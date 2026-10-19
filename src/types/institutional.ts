export interface FiiDiiParticipantPositioning {
  fiiLongFuturesRatio: number; // e.g. 38%
  fiiNetIndexFuturesContracts: number; // e.g. -24,500 (Net Short)
  fiiCallBuySellRatio: number; // e.g. 0.85
  fiiPutBuySellRatio: number; // e.g. 1.45
  clientRetailCallLongRatio: number; // e.g. 68% (Trapped Retail Calls)
  clientRetailPutLongRatio: number; // e.g. 32%
  proDeskNetBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  institutionalSentiment: 'STRONG_INSTITUTIONAL_BULLISH' | 'MODERATE_BULLISH' | 'INSTITUTIONAL_DISTRIBUTION_TRAP' | 'STRONG_INSTITUTIONAL_BEARISH' | 'NEUTRAL';
  retailContrarianTrapDetected: boolean;
  trapWarningHeadline: string;
  smartMoneyFlowIndex: number; // 0 to 100
  rationale: string;
}

export interface AtmStraddleAnalytics {
  atmStrike: number;
  ceLtp: number;
  peLtp: number;
  combinedStraddlePremium: number; // e.g. ₹140.50
  straddleImpliedMovePoints: number; // e.g. ±140.50 pts
  impliedUpperBoundary: number; // Spot + Straddle
  impliedLowerBoundary: number; // Spot - Straddle
  premiumDecayVelocityPercentPerHour: number; // e.g. 6.8% / hr
  decayRegime: 'ACCELERATED_THETA_DECAY' | 'NORMAL_DECAY' | 'GAMMA_EXPANSION_SPIKE';
  isOptionBuyerDay: boolean; // False if straddle is actively crushed by institutions
  marketMakerBias: 'SELLER_DOMINANCE_PIN' | 'EXPLOSIVE_EXPANSION' | 'EQUILIBRIUM';
  straddleStatusLabel: string;
}

export interface VolumeProfileValueArea {
  pointOfControlStrike: number; // POC (Highest traded volume)
  pocVolume: number;
  valueAreaHigh: number; // VAH (70% top bracket)
  valueAreaLow: number; // VAL (70% bottom bracket)
  valueAreaRange: number;
  isInsideValueArea: boolean;
  valueArea80PercentRuleActive: boolean;
  rotationTarget: number; // Opposite boundary if 80% rule triggers
  rotationDirection: 'ROTATE_DOWN_TO_VAL' | 'ROTATE_UP_TO_VAH' | 'RANGE_EXPANSION' | 'IN_VALUE_BALANCED';
  profileStatusLabel: string;
  rationale: string;
}

export interface HeavyweightTugOfWarStock {
  symbol: string;
  weightPercent: number; // e.g. 11.5%
  changePercent: number;
  pointContributionToNifty: number; // e.g. +14.2 pts
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface HeavyweightTugOfWarMatrix {
  top5Constituents: HeavyweightTugOfWarStock[];
  bankingSectorDeltaPoints: number;
  energyItDeltaPoints: number;
  netHeavyweightPointSpread: number;
  regime: 'SYNCHRONIC_BULLISH_THRUST' | 'SYNCHRONIC_BEARISH_THRUST' | 'TUG_OF_WAR_DEADLOCK' | 'SECTOR_ROTATION_BALANCED';
  deadlockWarning: boolean;
  statusLabel: string;
  institutionalPlaybookAdvice: string;
}

export interface VolatilitySkewSmile {
  atmIv: number;
  otm25DeltaPutIv: number;
  otm25DeltaCallIv: number;
  putCallSkewDifference: number; // Put IV - Call IV
  skewRatio: number;
  skewSentiment: 'INSTITUTIONAL_PANIC_PUT_SKEW' | 'COMPLACENT_CALL_EXPANSION' | 'BEAR_TRAP_IV_CRUSH' | 'BALANCED_SMILE';
  isBearTrapAbsorptionDetected: boolean;
  statusLabel: string;
  rationale: string;
}

export interface ExpiryGammaBurstTelemetry {
  isExpiryDay: boolean;
  minutesToClosingBell: number;
  isAfternoonWindowActive: boolean; // True post-01:30 PM
  gammaBurstCandidateStrike?: number;
  candidateType?: 'CE' | 'PE';
  candidateLtp?: number;
  unwindingVelocityScore: number; // 0 to 100
  heroOrZeroConfidence: number; // 0 to 100
  isGammaBurstImminent: boolean;
  statusLabel: string;
}

export interface InstitutionalSuiteAnalysis {
  fiiDii: FiiDiiParticipantPositioning;
  atmStraddle: AtmStraddleAnalytics;
  volumeProfile: VolumeProfileValueArea;
  heavyweightTugOfWar: HeavyweightTugOfWarMatrix;
  volatilitySkew: VolatilitySkewSmile;
  gammaBurst: ExpiryGammaBurstTelemetry;
  compositeInstitutionalConfidence: number; // 0 to 100
  overallVerdict: 'INSTITUTIONAL_BULLISH_THRUST' | 'INSTITUTIONAL_BEARISH_THRUST' | 'INSTITUTIONAL_THETA_CHOP' | 'RETAIL_TRAP_STAND_ASIDE';
  headline: string;
}
