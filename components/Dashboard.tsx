import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { UserProfile, MealLog, WeightLog, MealType, GoalType } from '../types';
import { analyzeFood, getDailyAdvice, getFoodSuggestion, generatePlanFromProfile } from '../services/geminiService';
import { getSingaporeDate, getSingaporeTime, getSingaporePastDate } from '../utils/dateUtils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine
} from 'recharts';
import {
  BotIcon,
  BreakfastIcon,
  CarbIcon,
  DinnerIcon,
  EnergyIcon,
  FatIcon,
  LunchIcon,
  MealIcon,
  ProteinIcon,
  SnackIcon,
  SparklesIcon,
  TrashIcon,
  ZapIcon,
} from './Icons';

const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

interface DashboardProps {
  user: UserProfile;
  logs: MealLog[];
  weightHistory: WeightLog[];
  onUpdateUser: (user: UserProfile) => void;
  onUpdateLogs: (logs: MealLog[]) => void;
  onUpdateWeight: (history: WeightLog[]) => void;
}

const renderInlineMarkdown = (text: string, keyPrefix: string) => {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-strong-${index}`} className="font-bold text-slate-950">{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={`${keyPrefix}-text-${index}`}>{part}</React.Fragment>;
  });
};

const FormattedAiAdvice: React.FC<{ text: string }> = ({ text }) => {
  const normalized = text.trim().replace(/\s+(\d+\.\s)/g, '\n$1');
  const lines = normalized.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const blocks: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ol key={`list-${blocks.length}`} className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-slate-700">
          {listItems}
        </ol>
      );
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      listItems.push(
        <li key={`li-${index}`}>{renderInlineMarkdown(numbered[1], `li-${index}`)}</li>
      );
      return;
    }

    flushList();
    blocks.push(
      <p key={`p-${index}`} className="text-sm leading-relaxed text-slate-700">
        {renderInlineMarkdown(line, `p-${index}`)}
      </p>
    );
  });

  flushList();
  return <div className="space-y-1">{blocks}</div>;
};

const KCAL_PER_KG = 7700;

const getDeficitContext = (goal: GoalType) => {
  switch (goal) {
    case GoalType.LOSE_WEIGHT:
      return { label: 'Deficit', goodColor: 'text-teal-600', badColor: 'text-red-500', isGood: (v: number) => v >= 0 };
    case GoalType.GAIN_MUSCLE:
      return { label: 'Surplus', goodColor: 'text-teal-600', badColor: 'text-orange-500', isGood: (v: number) => v <= 0 };
    case GoalType.MAINTAIN:
      return { label: 'Balance', goodColor: 'text-teal-600', badColor: 'text-amber-500', isGood: (v: number) => Math.abs(v) <= 100 };
  }
};

const formatDeficit = (value: number, ctx: ReturnType<typeof getDeficitContext>) => {
  const prefix = ctx.label === 'Surplus' ? (value <= 0 ? '+' : '') : (value >= 0 ? '+' : '');
  return `${prefix}${Math.abs(value)}`;
};

export const Dashboard: React.FC<DashboardProps> = ({ user, logs, weightHistory, onUpdateUser, onUpdateLogs, onUpdateWeight }) => {
  const [showLogModal, setShowLogModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showTDEEModal, setShowTDEEModal] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isCalculatingTDEE, setIsCalculatingTDEE] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string>('');

  // Chart Range State
  const [calorieRange, setCalorieRange] = useState<number>(7);
  const [weightRange, setWeightRange] = useState<number>(30);

  // Goals Edit State
  const [editGoals, setEditGoals] = useState({
    calories: user.targetCalories,
    protein: user.targetProtein,
    carbs: user.targetCarbs,
    fat: user.targetFat
  });

  // TDEE State
  const [newTDEE, setNewTDEE] = useState<number>(user.tdee || 2000);

  // Log Analysis Inputs
  const [foodDescriptionInput, setFoodDescriptionInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // New Log State (Defaults to Singapore Time)
  const [newLog, setNewLog] = useState<Partial<MealLog>>({
    date: getSingaporeDate(),
    time: getSingaporeTime(),
    type: MealType.LUNCH,
    description: '',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0
  });

  // New Weight Log State (Defaults to Singapore Date)
  const [newWeightLog, setNewWeightLog] = useState({
    date: getSingaporeDate(),
    weight: user.weight
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Memoized stats calculation
  const today = getSingaporeDate();
  const todayLogs = useMemo(() => logs.filter(l => l.date === today), [logs, today]);

  const totalCalories = useMemo(() => todayLogs.reduce((acc, curr) => acc + curr.calories, 0), [todayLogs]);
  const totalProtein = useMemo(() => todayLogs.reduce((acc, curr) => acc + curr.protein, 0), [todayLogs]);
  const totalCarbs = useMemo(() => todayLogs.reduce((acc, curr) => acc + curr.carbs, 0), [todayLogs]);
  const totalFat = useMemo(() => todayLogs.reduce((acc, curr) => acc + curr.fat, 0), [todayLogs]);

  const userTDEE = user.tdee || user.targetCalories;
  const todayDeficit = userTDEE - totalCalories;

  // All-time deficit: only count days that actually have logs
  const allLogsByDate = useMemo(() => logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = 0;
    acc[log.date] += log.calories;
    return acc;
  }, {} as Record<string, number>), [logs]);

  const totalDeficit = useMemo(() => {
    let deficit = 0;
    Object.values(allLogsByDate).forEach(dailyCals => {
      if (dailyCals > 0) { // Exclude days with zero calories logged
        deficit += (userTDEE - dailyCals);
      }
    });
    return deficit;
  }, [allLogsByDate, userTDEE]);

  const deficitCtx = useMemo(() => getDeficitContext(user.goal), [user.goal]);
  const estimatedWeightDelta = totalDeficit / KCAL_PER_KG;

  useEffect(() => {
    getDailyAdvice(user, logs).then(setAiAdvice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs.length]);

  // Keyboard escape handler for all modals
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmId) setDeleteConfirmId(null);
        else if (showLogModal) closeLogModal();
        else if (showGoalsModal) setShowGoalsModal(false);
        else if (showWeightModal) setShowWeightModal(false);
        else if (showTDEEModal) setShowTDEEModal(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showLogModal, showGoalsModal, showWeightModal, showTDEEModal, deleteConfirmId]);

  const handleGetSuggestion = async () => {
    setIsSuggesting(true);
    const remaining = {
      calories: user.targetCalories - totalCalories,
      protein: user.targetProtein - totalProtein,
      carbs: user.targetCarbs - totalCarbs,
      fat: user.targetFat - totalFat
    };

    try {
      const suggestion = await getFoodSuggestion(remaining, user.goal);
      setAiAdvice(suggestion);
    } catch (e) {
      setAiAdvice("Couldn't get a suggestion right now. Try again later.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleCalculateTDEE = async () => {
    setIsCalculatingTDEE(true);
    try {
      const plan = await generatePlanFromProfile(user);
      setNewTDEE(plan.tdee);
    } catch (e) {
      alert("Could not calculate TDEE automatically.");
    } finally {
      setIsCalculatingTDEE(false);
    }
  };

  const handleSaveTDEE = () => {
    onUpdateUser({ ...user, tdee: Number(newTDEE) });
    setShowTDEEModal(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      alert(`Image too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB.`);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!selectedImage && !foodDescriptionInput.trim()) {
      alert("Please provide either a photo or a text description.");
      return;
    }

    setIsAnalyzing(true);
    try {
      // Strip header from base64 if present
      const base64Data = selectedImage ? selectedImage.split(',')[1] : null;

      const result = await analyzeFood(base64Data, foodDescriptionInput);

      setNewLog(prev => ({
        ...prev,
        description: result.foodName,
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        imageUrl: selectedImage || undefined
      }));
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to analyze. Please try again or enter details manually.";
      alert(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveLog = () => {
    if (!newLog.description) return;
    const log: MealLog = {
      id: Date.now().toString(),
      date: newLog.date!,
      time: newLog.time!,
      type: newLog.type || MealType.SNACK,
      description: newLog.description,
      calories: Number(newLog.calories),
      protein: Number(newLog.protein),
      carbs: Number(newLog.carbs),
      fat: Number(newLog.fat),
      imageUrl: newLog.imageUrl
    };
    // Update logs via prop
    const updatedLogs = [log, ...logs];
    onUpdateLogs(updatedLogs);

    closeLogModal();
  };

  const closeLogModal = () => {
    setShowLogModal(false);
    // Reset form
    setNewLog({
      date: getSingaporeDate(),
      time: getSingaporeTime(),
      type: MealType.LUNCH,
      description: '',
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      imageUrl: undefined
    });
    setSelectedImage(null);
    setFoodDescriptionInput('');
  };

  const deleteLog = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDeleteLog = useCallback(() => {
    if (!deleteConfirmId) return;
    const updated = logs.filter(l => l.id !== deleteConfirmId);
    onUpdateLogs(updated);
    setDeleteConfirmId(null);
  }, [deleteConfirmId, logs, onUpdateLogs]);

  const handleUpdateGoals = () => {
    const cals = Number(editGoals.calories);
    const protein = Number(editGoals.protein);
    const carbs = Number(editGoals.carbs);
    const fat = Number(editGoals.fat);

    if (cals <= 0 || protein < 0 || carbs < 0 || fat < 0) {
      alert('Please enter valid positive values for all nutrition goals.');
      return;
    }
    if (cals > 10000) {
      alert('Calorie target seems unreasonably high. Please double-check.');
      return;
    }

    const updatedUser = {
      ...user,
      targetCalories: cals,
      targetProtein: protein,
      targetCarbs: carbs,
      targetFat: fat,
    };
    onUpdateUser(updatedUser);
    setShowGoalsModal(false);
  };

  const handleSaveWeight = () => {
    const weightVal = Number(newWeightLog.weight);
    if (!weightVal || weightVal <= 0) return;

    // 1. Update Weight History
    const existingIndex = weightHistory.findIndex(w => w.date === newWeightLog.date);
    let updatedHistory = [...weightHistory];

    if (existingIndex >= 0) {
      updatedHistory[existingIndex] = { date: newWeightLog.date, weight: weightVal };
    } else {
      updatedHistory.push({ date: newWeightLog.date, weight: weightVal });
    }

    // Sort by date string (YYYY-MM-DD works with string sort)
    updatedHistory.sort((a, b) => a.date.localeCompare(b.date));
    onUpdateWeight(updatedHistory);

    // 2. Update User Profile Current Weight 
    const isLatestDate = newWeightLog.date >= today;
    const lastHistoryDate = updatedHistory[updatedHistory.length - 1].date;

    if (isLatestDate || lastHistoryDate === newWeightLog.date) {
      onUpdateUser({ ...user, weight: weightVal });
    }

    setShowWeightModal(false);
  };

  // Group logs by date for the summary table
  const logsByDate = useMemo(() => logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {} as Record<string, MealLog[]>), [logs]);

  const sortedDates = useMemo(() => Object.keys(logsByDate).sort((a, b) => b.localeCompare(a)), [logsByDate]);

  // Prepare Calorie Chart Data
  const calorieChartData = useMemo(() => {
    const calorieCutoff = getSingaporePastDate(calorieRange);
    return Object.entries(logsByDate)
      .filter(([date]) => date >= calorieCutoff)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, dayLogs]) => ({
        date: date.slice(5),
        cals: (dayLogs as MealLog[]).reduce((a, c) => a + c.calories, 0)
      }));
  }, [logsByDate, calorieRange]);

  // Prepare Weight Chart Data
  const weightChartData = useMemo(() => {
    const weightCutoff = getSingaporePastDate(weightRange);
    return weightHistory
      .filter(w => w.date >= weightCutoff)
      .map(w => ({
        date: w.date.slice(5),
        weight: w.weight
      }));
  }, [weightHistory, weightRange]);

  const inputClass = "w-full border border-slate-200 rounded-xl p-2.5 text-sm bg-slate-50 text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary transition-all";
  const remainingCalories = user.targetCalories - totalCalories;
  const calorieProgress = Math.min((totalCalories / user.targetCalories) * 100, 100);
  const latestWeight = weightHistory.length > 0 ? weightHistory[weightHistory.length - 1].weight : user.weight;
  const weeklyStats = useMemo(() => {
    const weekStart = getSingaporePastDate(6);
    const weekLogs = logs.filter(log => log.date >= weekStart && log.date <= today);
    const weekDays = new Set(weekLogs.map(log => log.date));
    const totalWeekCalories = weekLogs.reduce((sum, log) => sum + log.calories, 0);
    const totalWeekProtein = weekLogs.reduce((sum, log) => sum + log.protein, 0);
    const loggedDays = weekDays.size;
    const averageCalories = loggedDays > 0 ? Math.round(totalWeekCalories / loggedDays) : 0;
    const averageProtein = loggedDays > 0 ? Math.round(totalWeekProtein / loggedDays) : 0;
    const weeklyDeficit = Array.from(weekDays).reduce((sum, date) => {
      const dailyCalories = weekLogs.filter(log => log.date === date).reduce((daySum, log) => daySum + log.calories, 0);
      return sum + (userTDEE - dailyCalories);
    }, 0);
    const weekWeights = weightHistory.filter(entry => entry.date >= weekStart && entry.date <= today).sort((a, b) => a.date.localeCompare(b.date));
    const weightChange = weekWeights.length >= 2 ? Number((weekWeights[weekWeights.length - 1].weight - weekWeights[0].weight).toFixed(1)) : null;

    return {
      loggedDays,
      mealCount: weekLogs.length,
      averageCalories,
      averageProtein,
      weeklyDeficit,
      weightChange,
    };
  }, [logs, today, userTDEE, weightHistory]);
  const macroSummary = [
    { label: 'Calories', value: totalCalories, target: user.targetCalories, unit: 'kcal', text: 'text-emerald-700', bar: 'bg-emerald-500', soft: 'bg-emerald-50', icon: <EnergyIcon className="w-5 h-5" /> },
    { label: 'Protein', value: totalProtein, target: user.targetProtein, unit: 'g', text: 'text-blue-700', bar: 'bg-blue-500', soft: 'bg-blue-50', icon: <ProteinIcon className="w-5 h-5" /> },
    { label: 'Carbs', value: totalCarbs, target: user.targetCarbs, unit: 'g', text: 'text-orange-700', bar: 'bg-orange-500', soft: 'bg-orange-50', icon: <CarbIcon className="w-5 h-5" /> },
    { label: 'Fat', value: totalFat, target: user.targetFat, unit: 'g', text: 'text-purple-700', bar: 'bg-purple-500', soft: 'bg-purple-50', icon: <FatIcon className="w-5 h-5" /> },
  ];

  const getMealIcon = (type: MealType) => {
    if (type === MealType.BREAKFAST) return <BreakfastIcon className="w-5 h-5" />;
    if (type === MealType.LUNCH) return <LunchIcon className="w-5 h-5" />;
    if (type === MealType.DINNER) return <DinnerIcon className="w-5 h-5" />;
    return <SnackIcon className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Today Summary Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm animate-slideUp">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-emerald-50 via-teal-50/60 to-transparent" aria-hidden="true"></div>
        <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.4fr_1fr] lg:p-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">Today · {today}</p>
            <div className="mt-3 flex flex-wrap items-end gap-x-3 gap-y-1">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">{totalCalories}</h2>
              <span className="pb-1 text-sm font-semibold text-slate-500">/ {user.targetCalories} kcal</span>
            </div>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
              {remainingCalories >= 0
                ? `${remainingCalories} kcal remaining for your daily target.`
                : `${Math.abs(remainingCalories)} kcal over target — keep the next meal light.`}
            </p>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-700 ${remainingCalories < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${calorieProgress}%` }}
                role="progressbar"
                aria-label="Daily calories progress"
                aria-valuenow={Math.round(calorieProgress)}
                aria-valuemin={0}
                aria-valuemax={100}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{deficitCtx.label} today</p>
              <p className={`mt-2 text-2xl font-extrabold ${deficitCtx.isGood(todayDeficit) ? deficitCtx.goodColor : deficitCtx.badColor}`}>{formatDeficit(todayDeficit, deficitCtx)}</p>
              {logs.length > 0 && (
                <>
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <p className="text-xs text-slate-400 mb-0.5">All-time {deficitCtx.label.toLowerCase()}</p>
                    <p className={`text-lg font-bold ${deficitCtx.isGood(totalDeficit) ? deficitCtx.goodColor : deficitCtx.badColor}`}>{formatDeficit(totalDeficit, deficitCtx)}</p>
                  </div>
                  {user.goal !== GoalType.MAINTAIN && (
                    <p className="mt-1 text-xs font-semibold text-slate-400">
                      &asymp; {Math.abs(estimatedWeightDelta).toFixed(1)} kg {estimatedWeightDelta >= 0 ? 'lost' : 'gained'}
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current weight</p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">{latestWeight}<span className="text-sm text-slate-500">kg</span></p>
            </div>
            <button
              onClick={() => setShowLogModal(true)}
              className="col-span-2 inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-600 sm:col-span-1 lg:col-span-2"
            >
              + Log meal
            </button>
          </div>
        </div>
      </section>

      {/* Weekly Summary */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 animate-slideUp delay-75">
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><EnergyIcon className="w-4 h-4" /></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">7-day avg</p>
          <p className="mt-1 text-xl font-extrabold text-slate-950">{weeklyStats.averageCalories}<span className="text-xs text-slate-500"> kcal</span></p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><ProteinIcon className="w-4 h-4" /></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Protein avg</p>
          <p className="mt-1 text-xl font-extrabold text-slate-950">{weeklyStats.averageProtein}<span className="text-xs text-slate-500">g</span></p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><ZapIcon className="w-4 h-4" /></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Weekly {deficitCtx.label.toLowerCase()}</p>
          <p className={`mt-1 text-xl font-extrabold ${deficitCtx.isGood(weeklyStats.weeklyDeficit) ? deficitCtx.goodColor : deficitCtx.badColor}`}>{formatDeficit(weeklyStats.weeklyDeficit, deficitCtx)}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-purple-50 text-purple-700"><MealIcon className="w-4 h-4" /></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Meals logged</p>
          <p className="mt-1 text-xl font-extrabold text-slate-950">{weeklyStats.mealCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-orange-50 text-orange-700"><SparklesIcon className="w-4 h-4" /></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Logged days</p>
          <p className="mt-1 text-xl font-extrabold text-slate-950">{weeklyStats.loggedDays}<span className="text-xs text-slate-500">/7</span></p>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-700"><FatIcon className="w-4 h-4" /></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Weight change</p>
          <p className={`mt-1 text-xl font-extrabold ${weeklyStats.weightChange === null ? 'text-slate-950' : weeklyStats.weightChange > 0 ? 'text-orange-600' : weeklyStats.weightChange < 0 ? 'text-emerald-600' : 'text-slate-950'}`}>{weeklyStats.weightChange === null ? '—' : `${weeklyStats.weightChange > 0 ? '+' : ''}${weeklyStats.weightChange}`}<span className="text-xs text-slate-500">kg</span></p>
        </div>
      </section>

      {/* Macro Progress */}
      <div className="flex justify-between items-center animate-slideUp">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Macro Progress</h2>
          <p className="text-sm text-slate-500">Clear daily targets with nutrition-specific colors.</p>
        </div>
        <button onClick={() => setShowGoalsModal(true)} className="text-sm text-primary hover:text-emerald-700 font-bold flex items-center bg-emerald-50 px-3 py-2 rounded-full transition-colors border border-emerald-100">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          Edit Goals
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 animate-slideUp delay-75">
        {macroSummary.map((macro) => {
          const isOver = macro.value > macro.target;
          const remaining = macro.target - macro.value;
          const percent = Math.min((macro.value / macro.target) * 100, 100);

          return (
            <div key={macro.label} className={`rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${isOver ? 'ring-2 ring-red-100' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{macro.label}</p>
                  <div className="mt-3 flex items-end gap-2">
                    <span className="text-3xl font-extrabold tracking-tight text-slate-950">{macro.value}</span>
                    <span className="pb-1 text-sm font-semibold text-slate-400">/ {macro.target}{macro.unit}</span>
                  </div>
                </div>
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${macro.soft} ${macro.text}`} aria-hidden="true">{macro.icon}</div>
              </div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${isOver ? 'bg-red-500' : macro.bar}`} style={{ width: `${percent}%` }}></div>
              </div>
              <p className={`mt-3 text-sm font-semibold ${isOver ? 'text-red-600' : macro.text}`}>
                {isOver ? `${Math.abs(remaining)}${macro.unit} over target` : `${remaining}${macro.unit} remaining`}
              </p>
            </div>
          );
        })}
      </div>

      {/* AI Advice Banner */}
      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6 animate-fadeIn delay-100">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="flex-shrink-0 bg-white p-3 rounded-2xl shadow-sm text-indigo-600 ring-1 ring-indigo-100">
          <BotIcon className="w-8 h-8" />
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-bold text-slate-950">AI Nutritionist</h4>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wide">Beta</span>
          </div>
          <FormattedAiAdvice text={aiAdvice || "Analyzing your patterns..."} />
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Based on recent logs and today’s remaining macros</p>
        </div>
        <div className="flex-shrink-0 mt-2 sm:mt-0">
          <button
            onClick={handleGetSuggestion}
            disabled={isSuggesting}
            className="group relative flex items-center justify-center px-5 py-3 border border-transparent text-sm font-bold rounded-full text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed active:scale-95"
          >
            {isSuggesting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Thinking...
              </>
            ) : (
              <>
                <MealIcon className="mr-2 h-4 w-4" />
                What to eat?
              </>
            )}
          </button>
        </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-slideUp delay-200">

        {/* Calorie History Chart */}
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-950 flex items-center gap-2">
              <span className="w-2.5 h-6 bg-emerald-500 rounded-full"></span>
              Calorie Intake
            </h3>
            <select
              value={calorieRange}
              onChange={(e) => setCalorieRange(Number(e.target.value))}
              className="text-xs border-slate-200 rounded-full border px-3 py-2 bg-slate-50 text-slate-700 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer hover:bg-slate-100 transition font-semibold"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 3 Months</option>
            </select>
          </div>
          <div className="h-64 w-full">
            {calorieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calorieChartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                  <YAxis fontSize={11} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                  <RechartsTooltip
                    cursor={{ fill: '#f9fafb' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '16px', fontFamily: 'Inter' }}
                    itemStyle={{ color: '#374151', fontWeight: 600 }}
                    labelStyle={{ color: '#9ca3af', marginBottom: '8px', fontSize: '12px' }}
                  />
                  <Bar dataKey="cals" fill="url(#colorCals)" radius={[6, 6, 0, 0]} name="Calories" barSize={24} />
                  <ReferenceLine y={userTDEE} stroke="#14b8a6" strokeDasharray="6 4" strokeWidth={2} label={{ value: `TDEE ${userTDEE}`, position: 'right', fill: '#14b8a6', fontSize: 11, fontWeight: 700 }} />
                  <defs>
                    <linearGradient id="colorCals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">No data for selected range</div>
            )}
          </div>
        </div>

        {/* Weight Trend Chart */}
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-950 flex items-center gap-2">
              <span className="w-2.5 h-6 bg-blue-500 rounded-full"></span>
              Weight Trend
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTDEEModal(true)}
                className="text-xs bg-purple-50 text-purple-600 px-3 py-2 rounded-full hover:bg-purple-100 transition font-bold border border-purple-100"
                title="Update TDEE"
              >
                <ZapIcon className="mr-1 inline h-3.5 w-3.5" /> TDEE
              </button>
              <button
                onClick={() => setShowWeightModal(true)}
                className="text-xs bg-blue-50 text-blue-600 px-3 py-2 rounded-full hover:bg-blue-100 transition font-bold border border-blue-100"
              >
                + Log
              </button>
              <select
                value={weightRange}
                onChange={(e) => setWeightRange(Number(e.target.value))}
                className="text-xs border-slate-200 rounded-full border px-3 py-2 bg-slate-50 text-slate-700 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer hover:bg-slate-100 transition font-semibold"
              >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 3 Months</option>
              </select>
            </div>
          </div>
          <div className="h-64 w-full">
            {weightChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="date" fontSize={11} tickMargin={10} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                  <YAxis domain={['auto', 'auto']} fontSize={11} axisLine={false} tickLine={false} tick={{ fill: '#9ca3af' }} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '16px', fontFamily: 'Inter' }}
                    itemStyle={{ color: '#374151', fontWeight: 600 }}
                    labelStyle={{ color: '#9ca3af', marginBottom: '8px', fontSize: '12px' }}
                  />
                  <Line type="monotone" dataKey="weight" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }} name="Weight (kg)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                {weightHistory.length === 0 ? "No weight history yet" : "No data for selected range"}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Action Button */}
      <div className="fixed bottom-8 right-8 z-40">
        <button
          onClick={() => setShowLogModal(true)}
          aria-label="Log a new meal"
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full p-4 shadow-xl shadow-emerald-200/50 flex items-center justify-center transition-all transform hover:scale-110 hover:-translate-y-1 active:scale-95 group"
        >
          <svg className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </button>
      </div>

      {/* Daily Logs List */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden animate-slideUp delay-300">
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg text-slate-950">Daily Journal</h3>
            <p className="text-sm text-slate-500">Grouped by day, optimized for quick meal review.</p>
          </div>
          <span className="hidden sm:inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{logs.length} meals</span>
        </div>

        <div className="space-y-4 p-4 md:hidden">
          {sortedDates.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">No meals logged yet</div>
          ) : sortedDates.map(date => {
            const dayLogs = [...logsByDate[date]].sort((a, b) => a.time.localeCompare(b.time));
            const dayTotalCals = dayLogs.reduce((a, c) => a + c.calories, 0);

            return (
              <section key={date} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-sm font-bold text-slate-900">{date}</h4>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{dayTotalCals} kcal</span>
                </div>
                {dayLogs.map(log => (
                  <article key={log.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 text-emerald-700" aria-hidden="true">{getMealIcon(log.type)}</div>
                        <div>
                          <p className="text-sm font-bold text-slate-950">{log.description}</p>
                          <p className="mt-0.5 text-xs font-semibold text-slate-400">{log.time} · {log.type}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteLog(log.id)} aria-label="Delete meal log" className="rounded-full p-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs font-bold">
                      <span className="rounded-xl bg-emerald-50 px-2 py-2 text-emerald-700">{log.calories} kcal</span>
                      <span className="rounded-xl bg-blue-50 px-2 py-2 text-blue-700">P {log.protein}g</span>
                      <span className="rounded-xl bg-orange-50 px-2 py-2 text-orange-700">C {log.carbs}g</span>
                      <span className="rounded-xl bg-purple-50 px-2 py-2 text-purple-700">F {log.fat}g</span>
                    </div>
                  </article>
                ))}
              </section>
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Meal</th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Food Item</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Calories</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">P (g)</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">C (g)</th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">F (g)</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {sortedDates.map(date => {
                const dayLogs = logsByDate[date].sort((a, b) => a.time.localeCompare(b.time));
                const dayTotalCals = dayLogs.reduce((a, c) => a + c.calories, 0);
                const dayTotalP = dayLogs.reduce((a, c) => a + c.protein, 0);
                const dayTotalC = dayLogs.reduce((a, c) => a + c.carbs, 0);
                const dayTotalF = dayLogs.reduce((a, c) => a + c.fat, 0);

                return (
                  <React.Fragment key={date}>
                    {dayLogs.map((log, idx) => (
                      <tr key={log.id} className="hover:bg-gray-50/80 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{idx === 0 ? date : ''}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
                            <span className="text-emerald-700">{getMealIcon(log.type)}</span>
                            <span className="ml-2">{log.type}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate font-medium" title={log.description}>{log.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold text-right">{log.calories}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.protein}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.carbs}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.fat}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => deleteLog(log.id)} aria-label="Delete meal log" className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50/50 font-bold border-t border-gray-100">
                      <td colSpan={3} className="px-6 py-3 text-right text-xs uppercase text-gray-400 tracking-wider">Daily Total</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900">{dayTotalCals}</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900">{dayTotalP}</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900">{dayTotalC}</td>
                      <td className="px-6 py-3 text-right text-sm text-gray-900">{dayTotalF}</td>
                      <td></td>
                    </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TDEE Update Modal */}
      {showTDEEModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900/40 transition-opacity backdrop-blur-sm" onClick={() => setShowTDEEModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full animate-scaleIn">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-xl leading-6 font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <ZapIcon className="w-5 h-5 text-purple-600" /> Update TDEE
                </h3>
                <p className="text-sm text-gray-500 mb-4">Total Daily Energy Expenditure is the number of calories you burn daily. This acts as your maintenance baseline.</p>

                <div className="space-y-4">
                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 flex flex-col gap-2">
                    <label className="block text-sm font-bold text-purple-900">Calculated TDEE (kcal)</label>
                    <input
                      type="number"
                      className="w-full bg-white border border-purple-200 rounded-lg p-3 text-lg font-bold text-purple-900 text-center focus:ring-2 focus:ring-purple-500 outline-none"
                      value={newTDEE}
                      onChange={e => setNewTDEE(Number(e.target.value))}
                    />
                  </div>

                  <button
                    onClick={handleCalculateTDEE}
                    disabled={isCalculatingTDEE}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none transition-colors"
                  >
                    {isCalculatingTDEE ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-purple-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Recalculate with AI
                      </>
                    ) : (
                      <>
                        <SparklesIcon className="w-4 h-4" /> Recalculate based on Profile
                      </>
                    )}
                  </button>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={handleSaveTDEE} className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2.5 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                  Update TDEE
                </button>
                <button type="button" onClick={() => setShowTDEEModal(false)} className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Goals Modal */}
      {showGoalsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900/40 transition-opacity backdrop-blur-sm" onClick={() => setShowGoalsModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full animate-scaleIn">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-xl leading-6 font-bold text-gray-900 mb-6">Adjust Nutrition Goals</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Daily Calories (kcal)</label>
                    <input type="number" min="1" max="10000" className={inputClass} value={editGoals.calories} onChange={e => setEditGoals({ ...editGoals, calories: Number(e.target.value) })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                      <input type="number" min="0" className={inputClass} value={editGoals.protein} onChange={e => setEditGoals({ ...editGoals, protein: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                      <input type="number" min="0" className={inputClass} value={editGoals.carbs} onChange={e => setEditGoals({ ...editGoals, carbs: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
                      <input type="number" min="0" className={inputClass} value={editGoals.fat} onChange={e => setEditGoals({ ...editGoals, fat: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={handleUpdateGoals} className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2.5 bg-primary text-base font-medium text-white hover:bg-emerald-600 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                  Update Goals
                </button>
                <button type="button" onClick={() => setShowGoalsModal(false)} className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Weight Modal */}
      {showWeightModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900/40 transition-opacity backdrop-blur-sm" onClick={() => setShowWeightModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm w-full animate-scaleIn">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-xl leading-6 font-bold text-gray-900 mb-6">Log Current Weight</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" className={inputClass} value={newWeightLog.date} onChange={e => setNewWeightLog({ ...newWeightLog, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                    <div className="relative">
                      <input type="number" step="0.1" className={inputClass} value={newWeightLog.weight} onChange={e => setNewWeightLog({ ...newWeightLog, weight: Number(e.target.value) })} />
                      <span className="absolute right-3 top-2.5 text-gray-400 text-sm">kg</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={handleSaveWeight} className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2.5 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                  Save Weight
                </button>
                <button type="button" onClick={() => setShowWeightModal(false)} className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Log Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-900/40 transition-opacity backdrop-blur-sm" onClick={closeLogModal}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full animate-scaleIn">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl leading-6 font-bold text-gray-900" id="modal-title">Log Meal</h3>
                  <button onClick={closeLogModal} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                {/* AI Analysis Section */}
                <div className="mb-8 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                  <label className="block text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" /> AI Smart Analysis
                  </label>

                  <div className="space-y-3">
                    <textarea
                      className="w-full border border-indigo-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[80px]"
                      placeholder="Describe your food (e.g. 'A bowl of beef noodles with extra egg')"
                      value={foodDescriptionInput}
                      onChange={(e) => setFoodDescriptionInput(e.target.value)}
                    />

                    <div className="flex items-center gap-2">
                      <label className="flex-1 cursor-pointer group">
                        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={handleFileSelect} />
                        <div className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed transition-all ${selectedImage ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 hover:border-gray-400'}`}>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span className="text-sm font-medium">{selectedImage ? 'Photo Selected' : 'Upload Photo (Optional)'}</span>
                        </div>
                      </label>

                      <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || (!selectedImage && !foodDescriptionInput)}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200 transition-all flex items-center gap-2"
                      >
                        {isAnalyzing ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Analyzing...
                          </>
                        ) : (
                          <>Analyze</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Manual Entry Form */}
                <div className="space-y-5">
                  <p className="text-sm font-bold text-gray-700 border-b pb-2">Review & Save</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Date</label>
                      <input type="date" className={inputClass} value={newLog.date} onChange={e => setNewLog({ ...newLog, date: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Type</label>
                      <select className={inputClass} value={newLog.type} onChange={e => setNewLog({ ...newLog, type: e.target.value as MealType })}>
                        {Object.values(MealType).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
                    <input type="text" placeholder="e.g. Chicken Rice" className={inputClass} value={newLog.description} onChange={e => setNewLog({ ...newLog, description: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                      <label className="block text-xs font-bold text-emerald-700 mb-1 text-center">Cals</label>
                      <input type="number" className="w-full bg-white border border-emerald-200 rounded text-center text-sm p-1 text-emerald-900 font-bold" value={newLog.calories} onChange={e => setNewLog({ ...newLog, calories: Number(e.target.value) })} />
                    </div>
                    <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                      <label className="block text-xs font-bold text-blue-700 mb-1 text-center">Pro</label>
                      <input type="number" className="w-full bg-white border border-blue-200 rounded text-center text-sm p-1 text-blue-900" value={newLog.protein} onChange={e => setNewLog({ ...newLog, protein: Number(e.target.value) })} />
                    </div>
                    <div className="bg-orange-50 p-2 rounded-lg border border-orange-100">
                      <label className="block text-xs font-bold text-orange-700 mb-1 text-center">Carb</label>
                      <input type="number" className="w-full bg-white border border-orange-200 rounded text-center text-sm p-1 text-orange-900" value={newLog.carbs} onChange={e => setNewLog({ ...newLog, carbs: Number(e.target.value) })} />
                    </div>
                    <div className="bg-purple-50 p-2 rounded-lg border border-purple-100">
                      <label className="block text-xs font-bold text-purple-700 mb-1 text-center">Fat</label>
                      <input type="number" className="w-full bg-white border border-purple-200 rounded text-center text-sm p-1 text-purple-900" value={newLog.fat} onChange={e => setNewLog({ ...newLog, fat: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={handleSaveLog} className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2.5 bg-emerald-500 text-base font-medium text-white hover:bg-emerald-600 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                  Save Meal
                </button>
                <button type="button" onClick={closeLogModal} className="mt-3 w-full inline-flex justify-center rounded-xl border border-gray-200 shadow-sm px-4 py-2.5 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-label="Confirm deletion">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setDeleteConfirmId(null)}></div>
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full relative z-10 animate-scaleIn">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500"><TrashIcon className="w-6 h-6" /></div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Delete this meal?</h3>
                <p className="text-sm text-gray-500 mb-6">This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteLog}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};