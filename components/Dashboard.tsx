import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, MealLog, WeightLog, MealType } from '../types';
import { analyzeFood, getDailyAdvice, getFoodSuggestion, generatePlanFromProfile } from '../services/geminiService';
import { getSingaporeDate, getSingaporeTime, getSingaporePastDate } from '../utils/dateUtils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

interface DashboardProps {
  user: UserProfile;
  logs: MealLog[];
  weightHistory: WeightLog[];
  onUpdateUser: (user: UserProfile) => void;
  onUpdateLogs: (logs: MealLog[]) => void;
  onUpdateWeight: (history: WeightLog[]) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, logs, weightHistory, onUpdateUser, onUpdateLogs, onUpdateWeight }) => {
  const [showLogModal, setShowLogModal] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [showTDEEModal, setShowTDEEModal] = useState(false);

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

  // Stats Calculation (Based on Singapore Date)
  const today = getSingaporeDate();
  const todayLogs = logs.filter(l => l.date === today);

  const totalCalories = todayLogs.reduce((acc, curr) => acc + curr.calories, 0);
  const totalProtein = todayLogs.reduce((acc, curr) => acc + curr.protein, 0);
  const totalCarbs = todayLogs.reduce((acc, curr) => acc + curr.carbs, 0);
  const totalFat = todayLogs.reduce((acc, curr) => acc + curr.fat, 0);

  // Deficit Calculations
  const userTDEE = user.tdee || user.targetCalories; // Fallback if old user
  const todayDeficit = userTDEE - totalCalories;

  // Calculate All-time Deficit
  // 1. Group all logs by date
  const allLogsByDate = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = 0;
    acc[log.date] += log.calories;
    return acc;
  }, {} as Record<string, number>);

  // 2. Sum deficits (Only for days that have logs)
  let totalDeficit = 0;
  Object.values(allLogsByDate).forEach(dailyCals => {
    totalDeficit += (userTDEE - dailyCals);
  });


  useEffect(() => {
    getDailyAdvice(user, logs).then(setAiAdvice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs.length]);

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
      alert("Failed to analyze. Please try again or enter details manually.");
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

  const deleteLog = (id: string) => {
    const updated = logs.filter(l => l.id !== id);
    onUpdateLogs(updated);
  };

  const handleUpdateGoals = () => {
    const updatedUser = {
      ...user,
      targetCalories: Number(editGoals.calories),
      targetProtein: Number(editGoals.protein),
      targetCarbs: Number(editGoals.carbs),
      targetFat: Number(editGoals.fat),
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
  const logsByDate = logs.reduce((acc, log) => {
    if (!acc[log.date]) acc[log.date] = [];
    acc[log.date].push(log);
    return acc;
  }, {} as Record<string, MealLog[]>);

  const sortedDates = Object.keys(logsByDate).sort((a, b) => b.localeCompare(a));

  // Prepare Calorie Chart Data
  const calorieCutoff = getSingaporePastDate(calorieRange);
  const calorieChartData = Object.entries(logsByDate)
    .filter(([date]) => date >= calorieCutoff)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, dayLogs]) => ({
      date: date.slice(5), // MM-DD
      cals: (dayLogs as MealLog[]).reduce((a, c) => a + c.calories, 0)
    }));

  // Prepare Weight Chart Data
  const weightCutoff = getSingaporePastDate(weightRange);
  const weightChartData = weightHistory
    .filter(w => w.date >= weightCutoff)
    .map(w => ({
      date: w.date.slice(5),
      weight: w.weight
    }));

  const inputClass = "w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-gray-50 text-gray-900 focus:ring-2 focus:ring-primary focus:border-primary transition-all";

  return (
    <div className="space-y-8 pb-20">
      {/* Top Stats Cards */}
      <div className="flex justify-between items-center animate-slideUp">
        <h2 className="text-xl font-bold text-gray-800">Daily Summary</h2>
        <button onClick={() => setShowGoalsModal(true)} className="text-sm text-primary hover:text-emerald-700 font-medium flex items-center bg-emerald-50 px-3 py-1.5 rounded-full transition-colors">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          Edit Goals
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 animate-slideUp delay-75">
        {/* Calories Card */}
        <div className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden group transition-all ${totalCalories > user.targetCalories ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-white border-gray-100 hover:shadow-md'}`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform ${totalCalories > user.targetCalories ? 'bg-red-100' : 'bg-emerald-100'}`}></div>
          <h3 className={`text-xs font-bold uppercase tracking-wider relative z-10 ${totalCalories > user.targetCalories ? 'text-red-600' : 'text-gray-500'}`}>
            Calories {totalCalories > user.targetCalories && '⚠️'}
          </h3>
          <div className="flex items-end mt-3 relative z-10">
            <span className={`text-3xl font-extrabold tracking-tight ${totalCalories > user.targetCalories ? 'text-red-600' : 'text-gray-900'}`}>
              {totalCalories}
            </span>
            <span className="text-gray-400 text-sm ml-2 mb-1.5 font-medium">/ {user.targetCalories}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4 relative z-10 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-1000 ${totalCalories > user.targetCalories ? 'bg-red-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`} style={{ width: `${Math.min((totalCalories / user.targetCalories) * 100, 100)}%` }}></div>
          </div>
        </div>

        {/* Protein Card */}
        <div className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden group transition-all ${totalProtein > user.targetProtein ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-white border-gray-100 hover:shadow-md'}`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform ${totalProtein > user.targetProtein ? 'bg-red-100' : 'bg-blue-100'}`}></div>
          <h3 className={`text-xs font-bold uppercase tracking-wider relative z-10 ${totalProtein > user.targetProtein ? 'text-red-600' : 'text-gray-500'}`}>
            Protein {totalProtein > user.targetProtein && '⚠️'}
          </h3>
          <div className="flex items-end mt-3 relative z-10">
            <span className="text-3xl font-extrabold text-gray-900 tracking-tight">{totalProtein}g</span>
            <span className="text-gray-400 text-sm ml-2 mb-1.5 font-medium">/ {user.targetProtein}g</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4 relative z-10 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-1000 ${totalProtein > user.targetProtein ? 'bg-red-500' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`} style={{ width: `${Math.min((totalProtein / user.targetProtein) * 100, 100)}%` }}></div>
          </div>
        </div>

        {/* Carbs Card */}
        <div className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden group transition-all ${totalCarbs > user.targetCarbs ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-white border-gray-100 hover:shadow-md'}`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform ${totalCarbs > user.targetCarbs ? 'bg-red-100' : 'bg-orange-100'}`}></div>
          <h3 className={`text-xs font-bold uppercase tracking-wider relative z-10 ${totalCarbs > user.targetCarbs ? 'text-red-600' : 'text-gray-500'}`}>
            Carbs {totalCarbs > user.targetCarbs && '⚠️'}
          </h3>
          <div className="flex items-end mt-3 relative z-10">
            <span className="text-3xl font-extrabold text-gray-900 tracking-tight">{totalCarbs}g</span>
            <span className="text-gray-400 text-sm ml-2 mb-1.5 font-medium">/ {user.targetCarbs}g</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4 relative z-10 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-1000 ${totalCarbs > user.targetCarbs ? 'bg-red-500' : 'bg-gradient-to-r from-orange-400 to-orange-600'}`} style={{ width: `${Math.min((totalCarbs / user.targetCarbs) * 100, 100)}%` }}></div>
          </div>
        </div>

        {/* Fat Card */}
        <div className={`p-6 rounded-2xl shadow-sm border relative overflow-hidden group transition-all ${totalFat > user.targetFat ? 'bg-red-50 border-red-200 ring-2 ring-red-100' : 'bg-white border-gray-100 hover:shadow-md'}`}>
          <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform ${totalFat > user.targetFat ? 'bg-red-100' : 'bg-purple-100'}`}></div>
          <h3 className={`text-xs font-bold uppercase tracking-wider relative z-10 ${totalFat > user.targetFat ? 'text-red-600' : 'text-gray-500'}`}>
            Fat {totalFat > user.targetFat && '⚠️'}
          </h3>
          <div className="flex items-end mt-3 relative z-10">
            <span className="text-3xl font-extrabold text-gray-900 tracking-tight">{totalFat}g</span>
            <span className="text-gray-400 text-sm ml-2 mb-1.5 font-medium">/ {user.targetFat}g</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-4 relative z-10 overflow-hidden">
            <div className={`h-2 rounded-full transition-all duration-1000 ${totalFat > user.targetFat ? 'bg-red-500' : 'bg-gradient-to-r from-purple-400 to-purple-600'}`} style={{ width: `${Math.min((totalFat / user.targetFat) * 100, 100)}%` }}></div>
          </div>
        </div>

        {/* Deficit Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition-all flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 bg-teal-100 rounded-bl-full -mr-4 -mt-4 opacity-50 group-hover:scale-110 transition-transform"></div>
          <div>
            <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider relative z-10">Calorie Deficit</h3>
            <div className="mt-2 relative z-10">
              <p className="text-xs text-gray-400 mb-0.5">Today</p>
              <span className={`text-2xl font-extrabold tracking-tight ${todayDeficit < 0 ? 'text-red-500' : 'text-teal-600'}`}>
                {todayDeficit > 0 ? '+' : ''}{todayDeficit}
              </span>
            </div>
          </div>
          <div className="mt-2 relative z-10 border-t pt-2 border-gray-100">
            <p className="text-xs text-gray-400 mb-0.5">Total All-Time</p>
            <span className={`text-lg font-bold tracking-tight ${totalDeficit < 0 ? 'text-red-500' : 'text-teal-600'}`}>
              {totalDeficit > 0 ? '+' : ''}{totalDeficit}
            </span>
          </div>
        </div>

      </div>

      {/* AI Advice Banner */}
      <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-sm hover:shadow-md transition-shadow animate-fadeIn delay-100">
        <div className="flex-shrink-0 bg-white p-3 rounded-full shadow-sm text-3xl">
          🤖
        </div>
        <div className="flex-grow">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-bold text-indigo-900">AI Nutritionist Insights</h4>
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wide">Beta</span>
          </div>
          <p className="text-indigo-800 text-sm leading-relaxed">{aiAdvice || "Analyzing your patterns..."}</p>
        </div>
        <div className="flex-shrink-0 mt-2 sm:mt-0">
          <button
            onClick={handleGetSuggestion}
            disabled={isSuggesting}
            className="group relative flex items-center justify-center px-5 py-2.5 border border-transparent text-sm font-semibold rounded-full text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-75 disabled:cursor-not-allowed active:scale-95"
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
                <span className="mr-2 text-lg">🍽️</span>
                What to eat?
              </>
            )}
          </button>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-slideUp delay-200">

        {/* Calorie History Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-6 bg-emerald-500 rounded-full"></span>
              Calorie Intake
            </h3>
            <select
              value={calorieRange}
              onChange={(e) => setCalorieRange(Number(e.target.value))}
              className="text-xs border-gray-200 rounded-lg border p-2 bg-gray-50 text-gray-700 focus:ring-emerald-500 focus:border-emerald-500 outline-none cursor-pointer hover:bg-gray-100 transition"
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
                  <defs>
                    <linearGradient id="colorCals" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.4} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">No data for selected range</div>
            )}
          </div>
        </div>

        {/* Weight Trend Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <span className="w-2.5 h-6 bg-blue-500 rounded-full"></span>
              Weight Trend
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTDEEModal(true)}
                className="text-xs bg-purple-50 text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition font-bold"
                title="Update TDEE"
              >
                ⚡ TDEE
              </button>
              <button
                onClick={() => setShowWeightModal(true)}
                className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition font-bold"
              >
                + Log
              </button>
              <select
                value={weightRange}
                onChange={(e) => setWeightRange(Number(e.target.value))}
                className="text-xs border-gray-200 rounded-lg border p-2 bg-gray-50 text-gray-700 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer hover:bg-gray-100 transition"
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
              <div className="flex items-center justify-center h-full text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
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
          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full p-4 shadow-xl shadow-emerald-200/50 flex items-center justify-center transition-all transform hover:scale-110 hover:-translate-y-1 active:scale-95 group"
        >
          <svg className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
        </button>
      </div>

      {/* Daily Logs List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-slideUp delay-300">
        <div className="p-6 border-b border-gray-50 bg-gray-50/50">
          <h3 className="font-bold text-lg text-gray-900">Daily Journal</h3>
        </div>

        <div className="overflow-x-auto">
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
                            {log.type === MealType.BREAKFAST && '🍳'}
                            {log.type === MealType.LUNCH && '🍱'}
                            {log.type === MealType.DINNER && '🍽️'}
                            {log.type === MealType.SNACK && '🥜'}
                            <span className="ml-2">{log.type}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs truncate font-medium" title={log.description}>{log.description}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold text-right">{log.calories}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.protein}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.carbs}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{log.fat}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => deleteLog(log.id)} className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
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
                  <span>⚡</span> Update TDEE
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
                        <span>✨</span> Recalculate based on Profile
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
                    <input type="number" className={inputClass} value={editGoals.calories} onChange={e => setEditGoals({ ...editGoals, calories: Number(e.target.value) })} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Protein (g)</label>
                      <input type="number" className={inputClass} value={editGoals.protein} onChange={e => setEditGoals({ ...editGoals, protein: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Carbs (g)</label>
                      <input type="number" className={inputClass} value={editGoals.carbs} onChange={e => setEditGoals({ ...editGoals, carbs: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fat (g)</label>
                      <input type="number" className={inputClass} value={editGoals.fat} onChange={e => setEditGoals({ ...editGoals, fat: Number(e.target.value) })} />
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
                    <span>✨</span> AI Smart Analysis
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
    </div>
  );
};