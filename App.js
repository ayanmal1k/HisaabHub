import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, StatusBar, Animated, Image, FlatList, TextInput, Pressable, ScrollView, Modal, Alert } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Calculator, Zap, TrendingUp, HandCoins, Settings, History, MoreVertical, Delete, DollarSign, ArrowRightLeft, Plus, ChevronLeft, ChevronRight, Calendar, Wallet, ArrowUpDown, Minus, Tag, Clock, Check, User, CreditCard, ArrowUpCircle, ArrowDownCircle, Trash2, AlertTriangle } from 'lucide-react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const PRIMARY_COLOR = '#00f0ff';
const INACTIVE_COLOR = '#94A3B8';
const LIGHT_BG = '#FFFFFF';
const APP_BG = '#F8FAFC';

// Calculator Colors (Bluish Theme)
const COLOR_AC = '#E0F2FE'; // Light blue
const COLOR_OP = '#BAE6FD'; // Medium blue
const COLOR_NUM = '#F1F5F9'; // Light grey/blue
const COLOR_EQ = PRIMARY_COLOR; // Cyan

const FiverrIcon = ({ color, size }) => (
  <Svg width={size} height={size} viewBox="-2.5 -2 24 24" fill="none">
    <Path
      d="M16.25 16.25v-10h-10v-.625c0-1.034.841-1.875 1.875-1.875H10V0H8.125A5.632 5.632 0 0 0 2.5 5.625v.625H0V10h2.5v6.25H0V20h8.75v-3.75h-2.5V10h6.285v6.25H10V20h8.75v-3.75h-2.5z"
      fill={color}
    />
    <Circle cx="14.375" cy="1.875" r="1.875" fill={color} />
  </Svg>
);

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState('Calculator');

  const splashFade = useRef(new Animated.Value(1)).current;
  const flatListRef = useRef(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(splashFade, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const tabs = [
    { name: 'Calculator', label: 'Calculator', icon: Calculator, component: CalculatorScreen },
    { name: 'Fiver', label: 'Fiverr', icon: FiverrIcon, component: FiverScreen },
    { name: 'Earning', label: 'Earning', icon: TrendingUp, component: EarningScreen },
    { name: 'Udhaar', label: 'Udhaar', icon: HandCoins, component: UdhaarScreen },
  ];

  const handleTabPress = (index) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setActiveTab(tabs[index].name);
  };

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const index = viewableItems[0].index;
      setActiveTab(tabs[index].name);
    }
  }).current;

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {showSplash && (
          <Animated.View style={[styles.splashContainer, { opacity: splashFade }]}>
            <Image
              source={require('./assets/icon.png')}
              style={styles.splashIcon}
              resizeMode="contain"
            />
          </Animated.View>
        )}

        <SafeAreaView style={styles.safeArea}>
          <FlatList
            ref={flatListRef}
            data={tabs}
            horizontal
            pagingEnabled
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            renderItem={({ item }) => (
              <View style={{ width }}>
                <item.component />
              </View>
            )}
            keyExtractor={(item) => item.name}
          />

          <View style={styles.tabBar}>
            {tabs.map((tab, index) => (
              <TabItem
                key={tab.name}
                name={tab.name}
                label={tab.label}
                icon={tab.icon}
                activeTab={activeTab}
                onPress={() => handleTabPress(index)}
              />
            ))}
          </View>
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const TabItem = ({ name, label, icon: Icon, activeTab, onPress }) => {
  const isActive = activeTab === name;
  return (
    <TouchableOpacity
      style={styles.tabItem}
      onPress={() => onPress(name)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
        <Icon
          color={isActive ? '#FFFFFF' : INACTIVE_COLOR}
          size={isActive ? 22 : 24}
        />
      </View>
      <Text style={[styles.tabLabel, { color: isActive ? PRIMARY_COLOR : INACTIVE_COLOR, fontWeight: isActive ? '700' : '500' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// Robust Calculator Engine inspired by the reference image
const CalculatorScreen = () => {
  const [display, setDisplay] = useState('0');
  const [liveResult, setLiveResult] = useState('');
  const [shouldReset, setShouldReset] = useState(false);
  const [selection, setSelection] = useState({ start: 1, end: 1 });
  const inputRef = useRef(null);

  // Helper to transform percentage expressions into mathematically evaluatable ones
  const transformExpression = (expr) => {
    let s = expr.replace(/ /g, '').replace(/x/g, '*');

    let changed = true;
    while (changed && s.includes('%')) {
      changed = false;
      // Match: everything before, an operator, digits, and a percent sign
      // This greedy regex finds the last operator before the %
      const match = s.match(/^(.*)([\+\-\*\/])(\d+(\.\d+)?)%/);
      if (match) {
        const [_, prefix, op, num] = match;
        if (op === '+' || op === '-') {
          // Additive/Subtractive: percentage of the entire prefix
          s = s.replace(match[0], `((${prefix})${op}((${prefix})*(${num}/100)))`);
        } else {
          // Multiplicative: just divide the preceding number by 100
          s = s.replace(match[0], `${prefix}${op}(${num}/100)`);
        }
        changed = true;
      } else {
        // Fallback for % at the start or with no preceding operator
        const simpleMatch = s.match(/(\d+(\.\d+)?)%/);
        if (simpleMatch) {
          s = s.replace(simpleMatch[0], `(${simpleMatch[1]}/100)`);
          changed = true;
        }
      }
    }
    return s;
  };

  // Simple parser for live results
  useEffect(() => {
    try {
      const sanitized = display.replace(/ /g, '').replace(/x/g, '*');
      if (!sanitized || /[+\-*/]$/.test(sanitized)) {
        setLiveResult('');
        return;
      }

      const transformed = transformExpression(display);
      const res = eval(transformed);

      if (typeof res === 'number' && isFinite(res)) {
        // Round to avoid floating point issues if needed, but let's keep it clean
        const fixedRes = Number(res.toFixed(8)).toString();
        setLiveResult('= ' + fixedRes);
      } else {
        setLiveResult('');
      }
    } catch (err) {
      setLiveResult('');
    }
  }, [display]);

  const handlePress = useCallback((val) => {
    if (val === 'AC') {
      setDisplay('0');
      setShouldReset(false);
      setSelection({ start: 1, end: 1 });
      return;
    }

    if (val === 'DEL') {
      const { start, end } = selection;
      if (start !== end) {
        const newDisplay = display.slice(0, start) + display.slice(end);
        updateDisplay(newDisplay, start);
      } else if (start > 0) {
        const charBefore = display[start - 1];
        const offset = charBefore === ' ' ? 2 : 1;
        const newDisplay = display.slice(0, start - offset) + display.slice(start);
        updateDisplay(newDisplay, start - offset);
      }
      return;
    }

    if (val === '=') {
      if (liveResult) {
        const finalRes = liveResult.replace('= ', '');
        setDisplay(finalRes);
        setShouldReset(true);
        setSelection({ start: finalRes.length, end: finalRes.length });
      }
      return;
    }

    if (['+', '-', '*', '/'].includes(val)) {
      const op = val === '*' ? ' x ' : ` ${val} `;
      insertText(op);
      setShouldReset(false);
      return;
    }

    if (val === '%') {
      insertText('%');
      return;
    }

    if (val === '.') {
      insertText('.');
      return;
    }

    if (shouldReset) {
      setDisplay(val);
      setSelection({ start: val.length, end: val.length });
      setShouldReset(false);
    } else {
      if (display === '0') {
        setDisplay(val);
        setSelection({ start: val.length, end: val.length });
      } else {
        insertText(val);
      }
    }
  }, [display, liveResult, shouldReset, selection]);

  const insertText = useCallback((text) => {
    const { start, end } = selection;
    const newDisplay = display.slice(0, start) + text + display.slice(end);
    updateDisplay(newDisplay, start + text.length);
  }, [display, selection]);

  const updateDisplay = useCallback((text, newCursor) => {
    setDisplay(text || '0');
    const finalCursor = text === '' ? 0 : newCursor;
    setSelection({ start: finalCursor, end: finalCursor });
  }, []);

  const CalcButton = memo(({ label, type = 'num', flex = 1, icon: Icon }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scale, {
        toValue: 0.9,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 40,
        bounciness: 10,
      }).start();
    };

    return (
      <View style={{ flex: flex, margin: 4, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={{ width: '100%', aspectRatio: 1, transform: [{ scale }] }}>
          <Pressable
            onPress={() => handlePress(label)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={({ pressed }) => [
              styles.aestheticButton,
              type === 'op' && styles.opCircle,
              type === 'ac' && styles.acCircle,
              type === 'eq' && styles.eqCircle,
              pressed && styles.buttonPressed,
              { width: '100%', height: '100%', borderRadius: 999 } // Rounded for the circle feel
            ]}
          >
            {Icon ? <Icon color={label === 'DEL' ? PRIMARY_COLOR : "#FFFFFF"} size={28} /> : (
              <Text style={[
                styles.aestheticButtonText,
                type === 'ac' && { color: '#000' },
                type === 'eq' && { color: '#2D0F21' }
              ]}>{label}</Text>
            )}
          </Pressable>
        </Animated.View>
      </View>
    );
  });

  return (
    <View style={styles.calcContainer}>
      <View style={styles.aestheticDisplay}>
        <TextInput
          ref={inputRef}
          style={styles.displayValue}
          value={display}
          showSoftInputOnFocus={false}
          selection={selection}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          caretHidden={false}
          cursorColor={PRIMARY_COLOR}
          multiline
          textAlign="right"
        />
        <Text style={styles.liveResultText}>{liveResult}</Text>
      </View>

      <View style={styles.aestheticKeypad}>
        <View style={styles.aestheticRow}>
          <CalcButton label="AC" type="ac" />
          <CalcButton label="()" type="op" />
          <CalcButton label="%" type="op" />
          <CalcButton label="/" type="op" />
        </View>
        <View style={styles.aestheticRow}>
          <CalcButton label="7" />
          <CalcButton label="8" />
          <CalcButton label="9" />
          <CalcButton label="*" type="op" />
        </View>
        <View style={styles.aestheticRow}>
          <CalcButton label="4" />
          <CalcButton label="5" />
          <CalcButton label="6" />
          <CalcButton label="-" type="op" />
        </View>
        <View style={styles.aestheticRow}>
          <CalcButton label="1" />
          <CalcButton label="2" />
          <CalcButton label="3" />
          <CalcButton label="+" type="op" />
        </View>
        <View style={styles.aestheticRow}>
          <CalcButton label="0" />
          <CalcButton label="." />
          <CalcButton label="DEL" icon={Delete} />
          <CalcButton label="=" type="eq" />
        </View>
      </View>
    </View>
  );
};

const FiverScreen = () => {
  const [amount, setAmount] = useState('0');
  const [isPayoneer, setIsPayoneer] = useState(true);
  const [showAddToEarning, setShowAddToEarning] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('April');
  const [selectedYear, setSelectedYear] = useState('2026');

  const gross = parseFloat(amount) || 0;
  const fiverrFee = gross * 0.2;
  const fixedFee = isPayoneer ? (gross > 0 ? 3 : 0) : 0;
  const remainingAfterFixed = Math.max(0, gross - fiverrFee - fixedFee);
  const processingFee = isPayoneer ? remainingAfterFixed * 0.025 : 0;
  const netUSD = Math.max(0, gross - fiverrFee - fixedFee - processingFee);
  const netPKR = netUSD * 276;

  const addToEarning = async () => {
    try {
        const saved = await AsyncStorage.getItem('hisaab_earning_records_v1');
        let currentRecords = saved ? JSON.parse(saved) : [];
        const recordIndex = currentRecords.findIndex(r => r.month === selectedMonth && r.year === selectedYear);
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const historyItem = {
          id: Date.now().toString(),
          amount: netPKR,
          op: '+',
          type: 'earned',
          label: 'Fiverr Earning',
          time: timestamp,
        };

        if (recordIndex >= 0) {
            currentRecords[recordIndex].earned += netPKR;
            currentRecords[recordIndex].history = [historyItem, ...(currentRecords[recordIndex].history || [])];
        } else {
            const newId = Date.now().toString();
            currentRecords = [{ id: newId, month: selectedMonth, year: selectedYear, earned: netPKR, received: 0, history: [historyItem] }, ...currentRecords];
        }
        await AsyncStorage.setItem('hisaab_earning_records_v1', JSON.stringify(currentRecords));
        Alert.alert('Success', `${netPKR.toLocaleString(undefined, { maximumFractionDigits: 0 })} PKR added to ${selectedMonth} ${selectedYear}`);
        setShowAddToEarning(false);
    } catch (e) { console.error(e); }
  };

  const handlePress = useCallback((val) => {
    if (val === 'AC') {
      setAmount('0');
    } else if (val === 'DEL') {
      setAmount(prev => (prev.length > 1 ? prev.slice(0, -1) : '0'));
    } else if (val === '.') {
      setAmount(prev => (prev.includes('.') ? prev : prev + '.'));
    } else {
      setAmount(prev => (prev === '0' ? val : prev + val));
    }
  }, []);

  const FiverButton = memo(({ label, icon: Icon, type = 'num' }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scale, { toValue: 0.9, useNativeDriver: true, speed: 50 }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 10 }).start();
    };

    return (
      <View style={{ flex: 1, margin: 4 }}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <Pressable
            onPress={() => handlePress(label)}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={({ pressed }) => [
              styles.fiverBtn,
              type === 'del' && { backgroundColor: COLOR_AC },
              pressed && styles.buttonPressed
            ]}
          >
            {Icon ? <Icon color="#1E293B" size={24} /> : <Text style={styles.fiverBtnText}>{label}</Text>}
          </Pressable>
        </Animated.View>
      </View>
    );
  });

  return (
    <View style={styles.fiverContainer}>
      <View style={{ flex: 1 }}>
        <View style={{ paddingVertical: 15 }}>
          <View style={styles.fiverCard}>
            <View style={styles.inputSection}>
              <View>
                <Text style={styles.inputLabel}>Gross Amount (USD)</Text>
                <Text style={styles.inputValue}>${amount}</Text>
              </View>
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setIsPayoneer(!isPayoneer)}
                style={styles.payoneerToggle}
              >
                <Text style={[styles.toggleText, isPayoneer && styles.toggleTextActive]}>Payoneer</Text>
                <View style={[styles.switchTrack, isPayoneer && styles.switchTrackActive]}>
                  <View style={[styles.switchKnob, isPayoneer && styles.switchKnobActive]} />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.breakdownSection}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Fiverr Fee (20%)</Text>
                <Text style={styles.breakdownValue}>-${fiverrFee.toFixed(2)}</Text>
              </View>
              {isPayoneer && (
                <>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Fixed Fee</Text>
                    <Text style={styles.breakdownValue}>-${fixedFee.toFixed(2)}</Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Processing (2.5%)</Text>
                    <Text style={styles.breakdownValue}>-${processingFee.toFixed(2)}</Text>
                  </View>
                </>
              )}
              <View style={[styles.breakdownRow, styles.netRow]}>
                <Text style={styles.netLabel}>Net USD</Text>
                <Text style={styles.netValue}>${netUSD.toFixed(2)}</Text>
              </View>
              {isPayoneer && (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Exchange Rate</Text>
                  <Text style={styles.breakdownValue}>x 276</Text>
                </View>
              )}
            </View>

            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>
                {isPayoneer ? 'Final PKR Amount' : 'Net USD Revenue'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.resultValue}>
                  {isPayoneer 
                    ? `${netPKR.toLocaleString(undefined, { maximumFractionDigits: 0 })} PKR`
                    : `$${netUSD.toFixed(2)}`
                  }
                </Text>
                {isPayoneer && netPKR > 0 && (
                  <TouchableOpacity 
                    style={styles.addToEarningBtn}
                    onPress={() => setShowAddToEarning(true)}
                  >
                    <Plus color="#FFF" size={20} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      <Modal visible={showAddToEarning} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAddToEarning(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add to Earnings</Text>
              <TouchableOpacity onPress={() => setShowAddToEarning(false)}>
                <Plus color="#94A3B8" size={24} style={{ transform: [{ rotate: '45deg' }] }} />
              </TouchableOpacity>
            </View>
            <View style={styles.recordPickerRow}>
              <Text style={styles.pickerLabel}>Month</Text>
              <View style={styles.simplePicker}>
                <FlatList horizontal showsHorizontalScrollIndicator={false} data={["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]} renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setSelectedMonth(item)} style={[styles.pickerItem, selectedMonth === item && styles.pickerItemActive]}>
                      <Text style={[styles.pickerItemText, selectedMonth === item && styles.pickerItemTextActive]}>{item.slice(0, 3)}</Text>
                    </TouchableOpacity>
                  )} keyExtractor={i => i} />
              </View>
              <Text style={styles.pickerLabel}>Year</Text>
              <View style={styles.simplePicker}>
                <FlatList horizontal showsHorizontalScrollIndicator={false} data={Array.from({ length: 11 }, (_, i) => (2020 + i).toString())} renderItem={({ item }) => (
                    <TouchableOpacity onPress={() => setSelectedYear(item)} style={[styles.pickerItem, selectedYear === item && styles.pickerItemActive]}>
                      <Text style={[styles.pickerItemText, selectedYear === item && styles.pickerItemTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )} keyExtractor={i => i} />
              </View>
            </View>
            <TouchableOpacity style={styles.addNowBtn} onPress={addToEarning}>
              <Text style={styles.addNowBtnText}>Add +{netPKR.toLocaleString(undefined, { maximumFractionDigits: 0 })} PKR</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.fiverKeypad}>
        <View style={styles.aestheticRow}>
          <FiverButton label="7" />
          <FiverButton label="8" />
          <FiverButton label="9" />
        </View>
        <View style={styles.aestheticRow}>
          <FiverButton label="4" />
          <FiverButton label="5" />
          <FiverButton label="6" />
        </View>
        <View style={styles.aestheticRow}>
          <FiverButton label="1" />
          <FiverButton label="2" />
          <FiverButton label="3" />
        </View>
        <View style={styles.aestheticRow}>
          <FiverButton label="." />
          <FiverButton label="0" />
          <FiverButton label="DEL" icon={Delete} type="del" />
        </View>
        <View style={styles.aestheticRow}>
          <FiverButton label="AC" type="del" />
        </View>
      </View>
    </View>
  );
};

const EarningScreen = () => {
  const [records, setRecords] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' or 'asc'

  const [adjAmount, setAdjAmount] = useState('');
  const [adjType, setAdjType] = useState('earned'); // 'earned' or 'received'
  const [adjLabel, setAdjLabel] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const [newMonth, setNewMonth] = useState('April');
  const [newYear, setNewYear] = useState('2026');

  const [isLoaded, setIsLoaded] = useState(false);

  // Persistence
  useEffect(() => {
    const loadRecords = async () => {
      try {
        const saved = await AsyncStorage.getItem('hisaab_earning_records_v1');
        if (saved) setRecords(JSON.parse(saved));
      } catch (e) { console.error('Earning load failed', e); }
      finally { setIsLoaded(true); }
    };
    loadRecords();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const saveRecords = async () => {
      try {
        await AsyncStorage.setItem('hisaab_earning_records_v1', JSON.stringify(records));
      } catch (e) { console.error('Earning save failed', e); }
    };
    saveRecords();
  }, [records, isLoaded]);

  const selectedRecord = records.find(r => r.id === editingId);

  const monthsList = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthMap = { "January": 0, "February": 1, "March": 2, "April": 3, "May": 4, "June": 5, "July": 6, "August": 7, "September": 8, "October": 9, "November": 10, "December": 11 };
  const yearsList = Array.from({ length: 11 }, (_, i) => (2020 + i).toString());

  const handleAddMonth = () => {
    const isDuplicate = records.some(r => r.month === newMonth && r.year === newYear);
    if (isDuplicate) {
      alert(`${newMonth} ${newYear} already exists!`);
      return;
    }
    const newId = Date.now().toString();
    setRecords([{ id: newId, month: newMonth, year: newYear, earned: 0, received: 0, history: [] }, ...records]);
    setShowAdd(false);
    setEditingId(newId);
  };

  const getSortedRecords = () => {
    return [...records].sort((a, b) => {
      const valA = parseInt(a.year) * 12 + monthMap[a.month];
      const valB = parseInt(b.year) * 12 + monthMap[b.month];
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  };

  const updateRecord = (id, field, value) => {
    const numValue = parseFloat(value) || 0;
    setRecords(records.map(r => r.id === id ? { ...r, [field]: numValue } : r));
  };

  const totalEarnedOverall = records.reduce((sum, r) => sum + r.earned, 0);

  const getOldestRecord = () => {
    if (records.length === 0) return null;
    const sorted = [...records].sort((a, b) => {
      const valA = parseInt(a.year) * 12 + monthMap[a.month];
      const valB = parseInt(b.year) * 12 + monthMap[b.month];
      return valA - valB;
    });
    return sorted[0];
  };
  const oldest = getOldestRecord();
  const summaryDateRange = oldest ? `From ${oldest.month.slice(0, 3)} ${oldest.year} till Now` : 'No records yet';

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteRecord = (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = () => {
    if (confirmDeleteId) {
      setRecords(records.filter(r => r.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    }
  };

  const applyAdjustment = (operation) => {
    const amount = parseFloat(adjAmount) || 0;
    if (amount <= 0) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setRecords(records.map(r => {
      if (r.id === editingId) {
        const currentVal = r[adjType] || 0;
        const newVal = operation === '+' ? currentVal + amount : Math.max(0, currentVal - amount);

        const historyItem = {
          id: Date.now().toString(),
          amount,
          op: operation,
          type: adjType,
          label: adjLabel || 'Manual Adjustment',
          time: timestamp,
        };

        return {
          ...r,
          [adjType]: newVal,
          history: [historyItem, ...(r.history || [])]
        };
      }
      return r;
    }));
    setAdjAmount('');
    setAdjLabel('');
  };

  if (editingId && selectedRecord) {
    const remaining = selectedRecord.earned - selectedRecord.received;
    return (
      <View style={styles.earningContainer}>
        <View style={styles.detailTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setEditingId(null)}>
            <ChevronLeft color="#0F172A" size={24} />
            <Text style={styles.backBtnText}>Earnings List</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={() => setEditingId(null)}>
            <Check color="#FFF" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>{selectedRecord.month} {selectedRecord.year}</Text>
          <Text style={styles.detailSubtitle}>Financial Adjustment</Text>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryChip, { backgroundColor: '#F0F9FF' }]}>
            <TrendingUp color={PRIMARY_COLOR} size={16} />
            <View>
              <Text style={styles.chipLabel}>Earned</Text>
              <Text style={styles.chipValue}>{selectedRecord.earned.toLocaleString()}</Text>
            </View>
          </View>
          <View style={[styles.summaryChip, { backgroundColor: '#F0FDF4' }]}>
            <Wallet color="#10B981" size={16} />
            <View>
              <Text style={styles.chipLabel}>Received</Text>
              <Text style={styles.chipValue}>{selectedRecord.received.toLocaleString()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.remainingBar}>
          <Text style={styles.remainingBarLabel}>Still Remaining</Text>
          <Text style={[styles.remainingBarValue, { color: remaining > 0 ? '#EF4444' : '#10B981' }]}>
            {remaining.toLocaleString()} PKR
          </Text>
        </View>

        <View style={styles.adjCard}>
          <Text style={styles.adjCardTitle}>Adjustment Center</Text>

          <View style={styles.adjInputRow}>
            <View style={[styles.adjInputBox, { flex: 1, marginBottom: 0 }]}>
              <Text style={styles.adjInputLabel}>Amount</Text>
              <TextInput
                style={styles.adjInput}
                keyboardType="numeric"
                value={adjAmount}
                onChangeText={setAdjAmount}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={[styles.adjInputBox, { flex: 1.5, marginBottom: 0 }]}>
              <Text style={styles.adjInputLabel}>Note / Label</Text>
              <TextInput
                style={[styles.adjInput, { fontSize: 18, color: '#0F172A' }]}
                value={adjLabel}
                onChangeText={setAdjLabel}
                placeholder="Ex: Client X"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.adjTypeToggle}>
            <TouchableOpacity
              style={[styles.adjTypeBtn, adjType === 'earned' && styles.adjTypeBtnActive]}
              onPress={() => setAdjType('earned')}
            >
              <Text style={[styles.adjTypeBtnText, adjType === 'earned' && styles.adjTypeBtnTextActive]}>Earned</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adjTypeBtn, adjType === 'received' && styles.adjTypeBtnActive]}
              onPress={() => setAdjType('received')}
            >
              <Text style={[styles.adjTypeBtnText, adjType === 'received' && styles.adjTypeBtnTextActive]}>Received</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.adjActionRow}>
            <TouchableOpacity
              style={[styles.adjActionBtn, styles.adjActionBtnMinus]}
              onPress={() => applyAdjustment('-')}
            >
              <Minus color="#FFF" size={24} />
              <Text style={styles.adjActionBtnText}>Subtract</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adjActionBtn, styles.adjActionBtnPlus]}
              onPress={() => applyAdjustment('+')}
            >
              <Plus color="#FFF" size={24} />
              <Text style={styles.adjActionBtnText}>Add Total</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.viewHistoryBtn}
          onPress={() => setShowHistory(true)}
        >
          <History color={PRIMARY_COLOR} size={20} />
          <Text style={styles.viewHistoryBtnText}>View Record History</Text>
        </TouchableOpacity>

        <Modal
          visible={showHistory}
          transparent
          animationType="slide"
          onRequestClose={() => setShowHistory(false)}
        >
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowHistory(false)} />
            <View style={[styles.modalContent, { flexShrink: 1, maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <History color="#0F172A" size={24} />
                  <Text style={styles.modalTitle}>History Log</Text>
                </View>
                <TouchableOpacity onPress={() => setShowHistory(false)}>
                  <Plus color="#94A3B8" size={24} style={{ transform: [{ rotate: '45deg' }] }} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={selectedRecord.history || []}
                style={styles.modalScrollArea}
                showsVerticalScrollIndicator={false}
                keyExtractor={item => item.id}
                ListEmptyComponent={
                  <View style={styles.emptyHistory}>
                    <Clock color="#CBD5E1" size={32} />
                    <Text style={styles.emptyHistoryText}>No adjustments recorded yet</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={styles.historyItem}>
                    <View style={styles.historyItemLeft}>
                      <View style={[styles.historyIconBox, { backgroundColor: item.op === '+' ? '#F0FDF4' : '#FEF2F2' }]}>
                        {item.op === '+' ? <Plus color="#10B981" size={16} /> : <Minus color="#EF4444" size={16} />}
                      </View>
                      <View>
                        <Text style={styles.historyLabel}>{item.label}</Text>
                        <View style={styles.historySubRow}>
                          <Text style={styles.historyTime}>{item.time}</Text>
                          <View style={styles.dot} />
                          <Text style={[styles.historyType, { color: item.type === 'earned' ? PRIMARY_COLOR : '#10B981' }]}>
                            {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.historyAmount, { color: item.op === '+' ? '#10B981' : '#EF4444' }]}>
                      {item.op}{item.amount.toLocaleString()}
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.earningContainer}>
      <View style={styles.earningHeader}>
        <View>
          <Text style={styles.earningTitle}>Earnings</Text>
          <Text style={styles.earningSubtitle}>Monthly Records</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.addCircleBtn, { backgroundColor: '#F1F5F9' }]}
            onPress={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
          >
            <ArrowUpDown color={PRIMARY_COLOR} size={20} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addCircleBtn} onPress={() => setShowAdd(true)}>
            <Plus color="#FFF" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.earningSummaryBox}>
        <View style={styles.earningSummaryMain}>
          <View style={styles.earningSummaryIcon}>
            <DollarSign color="#FFF" size={24} />
          </View>
          <View>
            <Text style={styles.earningSummaryLabel}>Total Earned So Far</Text>
            <Text style={styles.earningSummaryValue}>{totalEarnedOverall.toLocaleString()} PKR</Text>
          </View>
        </View>
        <View style={styles.earningSummaryFooter}>
          <Clock color="#64748B" size={14} />
          <Text style={styles.earningSummaryFooterText}>{summaryDateRange}</Text>
        </View>
      </View>

      <Modal
        visible={showAdd}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAdd(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAdd(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Period</Text>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Plus color="#94A3B8" size={24} style={{ transform: [{ rotate: '45deg' }] }} />
              </TouchableOpacity>
            </View>

            <View style={styles.recordPickerRow}>
              <Text style={styles.pickerLabel}>Month</Text>
              <View style={styles.simplePicker}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={monthsList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setNewMonth(item)}
                      style={[styles.pickerItem, newMonth === item && styles.pickerItemActive]}
                    >
                      <Text style={[styles.pickerItemText, newMonth === item && styles.pickerItemTextActive]}>{item.slice(0, 3)}</Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={i => i}
                />
              </View>

              <Text style={styles.pickerLabel}>Year</Text>
              <View style={styles.simplePicker}>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={yearsList}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => setNewYear(item)}
                      style={[styles.pickerItem, newYear === item && styles.pickerItemActive]}
                    >
                      <Text style={[styles.pickerItemText, newYear === item && styles.pickerItemTextActive]}>{item}</Text>
                    </TouchableOpacity>
                  )}
                  keyExtractor={i => i}
                />
              </View>
            </View>

            <TouchableOpacity style={styles.addNowBtn} onPress={handleAddMonth}>
              <Text style={styles.addNowBtnText}>Create Record</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        data={getSortedRecords()}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => {
          const remaining = item.earned - item.received;
          return (
            <TouchableOpacity
              style={styles.recordCard}
              onPress={() => setEditingId(item.id)}
              onLongPress={() => handleDeleteRecord(item.id)}
            >
              <View style={styles.recordCardLeft}>
                <View style={styles.calendarIconBox}>
                  <Calendar color={PRIMARY_COLOR} size={20} />
                </View>
                <View>
                  <Text style={styles.recordMonth}>{item.month} {item.year}</Text>
                  <Text style={styles.recordRemaining}>{remaining > 0 ? `${remaining.toLocaleString()} PKR remaining` : 'Full received'}</Text>
                </View>
              </View>
              <View style={styles.recordCardRight}>
                <Text style={styles.recordTotal}>{item.earned.toLocaleString()}</Text>
                <Text style={styles.recordCurrency}>PKR</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <Modal visible={confirmDeleteId !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmDeleteId(null)} />
          <View style={styles.modalContent}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconBox}>
                <Trash2 color="#EF4444" size={32} />
              </View>
              <Text style={styles.deleteTitle}>Delete Month?</Text>
              <Text style={styles.deleteSubtitle}>This action cannot be undone. All data for this month will be lost.</Text>
            </View>
            <View style={styles.deleteActionRow}>
              <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setConfirmDeleteId(null)}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmDelete}>
                <Text style={styles.deleteConfirmText}>Delete Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const UdhaarScreen = () => {
  const [contacts, setContacts] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');

  const [adjAmount, setAdjAmount] = useState('');
  const [adjLabel, setAdjLabel] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [sortOrder, setSortOrder] = useState('desc');

  const [isLoaded, setIsLoaded] = useState(false);

  // Persistence logic
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const saved = await AsyncStorage.getItem('hisaab_udhaar_contacts');
        if (saved) setContacts(JSON.parse(saved));
      } catch (e) { console.error('Udhaar load failed', e); }
      finally { setIsLoaded(true); }
    };
    loadContacts();
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    const saveContacts = async () => {
      try {
        await AsyncStorage.setItem('hisaab_udhaar_contacts', JSON.stringify(contacts));
      } catch (e) { console.error('Udhaar save failed', e); }
    };
    saveContacts();
  }, [contacts, isLoaded]);

  const selectedContact = contacts.find(c => c.id === editingId);

  const totalToGet = contacts.reduce((sum, c) => c.balance > 0 ? sum + c.balance : sum, 0);
  const totalToGive = contacts.reduce((sum, c) => c.balance < 0 ? sum + Math.abs(c.balance) : sum, 0);

  const handleAddContact = () => {
    if (!newName.trim()) return;
    const newId = Date.now().toString();
    setContacts([{ id: newId, name: newName, balance: 0, history: [] }, ...contacts]);
    setNewName('');
    setShowAdd(false);
    setEditingId(newId);
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const handleDeleteContact = (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = () => {
    if (confirmDeleteId) {
      setContacts(contacts.filter(c => c.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    }
  };

  const applyAdjustment = (operation) => {
    const amount = parseFloat(adjAmount) || 0;
    if (amount <= 0) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isLent = operation === '+'; // Lent (+) means He owes me, Borrowed (-) means I owe him

    setContacts(contacts.map(c => {
      if (c.id === editingId) {
        const newVal = isLent ? c.balance + amount : c.balance - amount;

        const historyItem = {
          id: Date.now().toString(),
          amount,
          op: isLent ? 'Lent' : 'Borrowed',
          label: adjLabel || (isLent ? 'Lent Money' : 'Borrowed Money'),
          time: timestamp,
          isNegative: !isLent
        };

        return {
          ...c,
          balance: newVal,
          history: [historyItem, ...(c.history || [])]
        };
      }
      return c;
    }));
    setAdjAmount('');
    setAdjLabel('');
  };

  const getSortedContacts = () => {
    return [...contacts].sort((a, b) => {
      if (sortOrder === 'desc') return Math.abs(b.balance) - Math.abs(a.balance);
      return Math.abs(a.balance) - Math.abs(b.balance);
    });
  };

  if (editingId && selectedContact) {
    return (
      <View style={styles.earningContainer}>
        <View style={styles.detailTopRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setEditingId(null)}>
            <ChevronLeft color="#0F172A" size={24} />
            <Text style={styles.backBtnText}>All Contacts</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={() => setEditingId(null)}>
            <Check color="#FFF" size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.detailHeader}>
          <Text style={styles.detailTitle}>{selectedContact.name}</Text>
          <Text style={styles.detailSubtitle}>Debt Ledger</Text>
        </View>

        <View style={styles.remainingBar}>
          <Text style={styles.remainingBarLabel}>Net Balance</Text>
          <Text style={[styles.remainingBarValue, { color: selectedContact.balance >= 0 ? '#10B981' : '#EF4444' }]}>
            {Math.abs(selectedContact.balance).toLocaleString()} PKR
          </Text>
        </View>
        <Text style={[styles.statusText, { color: selectedContact.balance >= 0 ? '#10B981' : '#EF4444' }]}>
          {selectedContact.balance >= 0 ? 'He Lends Me (You Get)' : 'I have to Give (You Owe)'}
        </Text>

        <View style={styles.adjCard}>
          <Text style={styles.adjCardTitle}>Transaction Hub</Text>

          <View style={styles.adjInputRow}>
            <View style={[styles.adjInputBox, { flex: 1, marginBottom: 0 }]}>
              <Text style={styles.adjInputLabel}>Amount</Text>
              <TextInput
                style={styles.adjInput}
                keyboardType="numeric"
                value={adjAmount}
                onChangeText={setAdjAmount}
                placeholder="0.00"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={[styles.adjInputBox, { flex: 1.5, marginBottom: 0 }]}>
              <Text style={styles.adjInputLabel}>Note / Label</Text>
              <TextInput
                style={[styles.adjInput, { fontSize: 18, color: '#0F172A' }]}
                value={adjLabel}
                onChangeText={setAdjLabel}
                placeholder="Why?"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <View style={styles.adjActionRow}>
            <TouchableOpacity
              style={[styles.adjActionBtn, { backgroundColor: '#EF4444' }]}
              onPress={() => applyAdjustment('-')}
            >
              <Text style={styles.adjActionBtnText}>Borrowed (Got)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.adjActionBtn, { backgroundColor: '#10B981' }]}
              onPress={() => applyAdjustment('+')}
            >
              <Text style={styles.adjActionBtnText}>Lent (Gave)</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.viewHistoryBtn}
          onPress={() => setShowHistory(true)}
        >
          <History color={PRIMARY_COLOR} size={20} />
          <Text style={styles.viewHistoryBtnText}>View Full History</Text>
        </TouchableOpacity>

        <Modal visible={showHistory} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowHistory(false)} />
            <View style={[styles.modalContent, { flexShrink: 1, maxHeight: '80%' }]}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <CreditCard color="#0F172A" size={24} />
                  <Text style={styles.modalTitle}>Udhaar Log</Text>
                </View>
                <TouchableOpacity onPress={() => setShowHistory(false)}>
                  <Plus color="#94A3B8" size={24} style={{ transform: [{ rotate: '45deg' }] }} />
                </TouchableOpacity>
              </View>

              <FlatList
                data={selectedContact.history || []}
                style={styles.modalScrollArea}
                keyExtractor={item => item.id}
                ListEmptyComponent={
                  <View style={styles.emptyHistory}>
                    <Clock color="#CBD5E1" size={32} />
                    <Text style={styles.emptyHistoryText}>No transactions logged</Text>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={styles.historyItem}>
                    <View style={styles.historyItemLeft}>
                      <View style={[styles.historyIconBox, { backgroundColor: !item.isNegative ? '#F0FDF4' : '#FEF2F2' }]}>
                        {!item.isNegative ? <Check color="#10B981" size={16} /> : <Minus color="#EF4444" size={16} />}
                      </View>
                      <View>
                        <Text style={styles.historyLabel}>{item.label}</Text>
                        <View style={styles.historySubRow}>
                          <Text style={styles.historyTime}>{item.time}</Text>
                          <View style={styles.dot} />
                          <Text style={[styles.historyType, { color: !item.isNegative ? '#10B981' : '#EF4444' }]}>
                            {item.op}
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.historyAmount, { color: !item.isNegative ? '#10B981' : '#EF4444' }]}>
                      {!item.isNegative ? '+' : '-'}{item.amount.toLocaleString()}
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.earningContainer}>
      <View style={styles.earningHeader}>
        <View>
          <Text style={styles.earningTitle}>Udhaar Tracker</Text>
          <Text style={styles.earningSubtitle}>Money Lent & Borrowed</Text>
        </View>
        <TouchableOpacity
          style={[styles.addCircleBtn, { backgroundColor: '#F1F5F9' }]}
          onPress={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
        >
          <ArrowUpDown color={PRIMARY_COLOR} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.udhaarSummaryRow}>
        <View style={[styles.udhaarSummaryBox, { borderLeftColor: '#10B981' }]}>
          <View style={styles.summaryLabelRow}>
            <ArrowUpCircle color="#10B981" size={16} />
            <Text style={styles.summaryLabel}>To Get</Text>
          </View>
          <Text style={[styles.summaryValue, { color: '#10B981' }]}>
            {totalToGet.toLocaleString()}
          </Text>
        </View>
        <View style={[styles.udhaarSummaryBox, { borderLeftColor: '#EF4444' }]}>
          <View style={styles.summaryLabelRow}>
            <ArrowDownCircle color="#EF4444" size={16} />
            <Text style={styles.summaryLabel}>To Give</Text>
          </View>
          <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
            {totalToGive.toLocaleString()}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.addPersonHeroBtn} onPress={() => setShowAdd(true)}>
        <View style={styles.addPersonHeroContent}>
          <View style={styles.addPersonHeroIconBox}>
            <Plus color="#FFF" size={28} />
          </View>
          <View>
            <Text style={styles.addPersonHeroTitle}>Add New Person</Text>
            <Text style={styles.addPersonHeroSubtitle}>Start tracking a new debt</Text>
          </View>
        </View>
      </TouchableOpacity>

      <Modal visible={showAdd} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowAdd(false)} />
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.modalIconCircle}>
                  <User color={PRIMARY_COLOR} size={20} />
                </View>
                <Text style={styles.modalTitle}>Add Person</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAdd(false)}>
                <Plus color="#94A3B8" size={24} style={{ transform: [{ rotate: '45deg' }] }} />
              </TouchableOpacity>
            </View>

            <View style={styles.adjInputBox}>
              <Text style={styles.adjInputLabel}>Person Name</Text>
              <TextInput
                style={[styles.adjInput, { fontSize: 20, height: 50 }]}
                value={newName}
                onChangeText={setNewName}
                placeholder="Ex: John Doe"
                placeholderTextColor="#94A3B8"
                autoFocus
              />
            </View>

            <View style={styles.modalInfoRow}>
              <Clock color="#64748B" size={14} />
              <Text style={styles.modalInfoText}>This will create a new debt ledger.</Text>
            </View>

            <TouchableOpacity style={styles.addNowBtn} onPress={handleAddContact}>
              <Text style={styles.addNowBtnText}>Create Record</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        data={getSortedContacts()}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.udhaarCardWide}
            onPress={() => setEditingId(item.id)}
            onLongPress={() => handleDeleteContact(item.id)}
          >
            <View style={styles.udhaarMainInfo}>
              <Text style={styles.udhaarCardName}>{item.name}</Text>
              <View style={[styles.udhaarStatusBadge, { backgroundColor: item.balance >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
                <Text style={[styles.udhaarStatusText, { color: item.balance >= 0 ? '#10B981' : '#EF4444' }]}>
                  {item.balance >= 0 ? 'You Get' : 'You Give'}
                </Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[styles.udhaarCardAmount, { color: item.balance >= 0 ? '#10B981' : '#EF4444' }]}>
                {Math.abs(item.balance).toLocaleString()}
                <Text style={{ fontSize: 14 }}> PKR</Text>
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={confirmDeleteId !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setConfirmDeleteId(null)} />
          <View style={styles.modalContent}>
            <View style={styles.deleteModalHeader}>
              <View style={styles.deleteIconBox}>
                <AlertTriangle color="#EF4444" size={32} />
              </View>
              <Text style={styles.deleteTitle}>Remove Contact?</Text>
              <Text style={styles.deleteSubtitle}>Are you sure you want to delete this contact and all their transaction history?</Text>
            </View>
            <View style={styles.deleteActionRow}>
              <TouchableOpacity style={styles.deleteCancelBtn} onPress={() => setConfirmDeleteId(null)}>
                <Text style={styles.deleteCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmDelete}>
                <Text style={styles.deleteConfirmText}>Remove Person</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  safeArea: {
    flex: 1,
  },
  calcContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  aestheticDisplay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  displayValue: {
    fontSize: 54, // Smaller for multiline expressions
    fontWeight: '300',
    color: '#0F172A',
    width: '100%',
  },
  liveResultText: {
    fontSize: 32,
    color: PRIMARY_COLOR,
    fontWeight: '500',
    marginTop: 8,
  },
  aestheticKeypad: {
    paddingBottom: 30,
    gap: 15,
  },
  aestheticRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  aestheticButton: {
    backgroundColor: COLOR_NUM,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2, // Subtle shadow for Android
    shadowColor: '#000', // Subtle shadow for iOS
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  aestheticButtonText: {
    fontSize: 34,
    color: '#1E293B',
    fontWeight: '400',
  },
  opCircle: {
    backgroundColor: COLOR_OP,
  },
  acCircle: {
    backgroundColor: COLOR_AC,
  },
  eqCircle: {
    backgroundColor: COLOR_EQ,
  },
  buttonPressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(0,0,0,0.05)', // Overlay a slight darkness
  },
  tabBar: {
    flexDirection: 'row',
    height: 90,
    backgroundColor: LIGHT_BG,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingBottom: 25,
    paddingTop: 12,
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  activeIconContainer: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 24,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  screenContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: LIGHT_BG,
  },
  placeholderText: {
    fontSize: 18,
    color: '#64748B',
    textAlign: 'center',
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  splashIcon: {
    width: 150,
    height: 150,
  },
  fiverContainer: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: APP_BG,
  },
  fiverHeader: {
    marginTop: 10,
    marginBottom: 15,
  },
  fiverTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  fiverSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  fiverCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5,
    marginBottom: 10,
  },
  inputSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 15,
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  inputValue: {
    fontSize: 36,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  payoneerToggle: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  toggleTextActive: {
    color: '#10B981',
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    padding: 2,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: '#10B981',
  },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  switchKnobActive: {
    alignSelf: 'flex-end',
  },
  breakdownSection: {
    gap: 4,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  netRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  netLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  netValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  resultSection: {
    backgroundColor: '#EEF2FF',
    marginHorizontal: -20,
    marginBottom: -20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 15,
    alignItems: 'center',
  },
  pkrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
    marginBottom: 8,
  },
  pkrBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  resultLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  resultValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#1E293B',
  },
  fiverKeypad: {
    paddingBottom: 20,
    gap: 8,
  },
  fiverBtn: {
    height: 50,
    backgroundColor: '#F1F5F9',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fiverBtnText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1E293B',
  },
  earningContainer: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: APP_BG,
  },
  earningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  earningTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  earningSubtitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  addCircleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  addRecordBox: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  simplePicker: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  pickerItemActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  pickerItemTextActive: {
    color: '#FFF',
  },
  addNowBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addNowBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  recordCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  calendarIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordMonth: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  recordRemaining: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  recordCardRight: {
    alignItems: 'flex-end',
  },
  recordTotal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  recordCurrency: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
    gap: 4,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  detailHeader: {
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailSubtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    gap: 10,
  },
  chipLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  chipValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  remainingBar: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  remainingBarLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  remainingBarValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  adjCard: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  adjCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 20,
    textAlign: 'center',
  },
  adjInputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  adjInputBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  adjInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  adjInput: {
    fontSize: 28,
    fontWeight: '800',
    color: PRIMARY_COLOR,
    padding: 0,
  },
  adjTypeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  adjTypeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  adjTypeBtnActive: {
    backgroundColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  adjTypeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  adjTypeBtnTextActive: {
    color: '#0F172A',
  },
  adjActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  adjActionBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  adjActionBtnMinus: {
    backgroundColor: '#EF4444',
  },
  adjActionBtnPlus: {
    backgroundColor: '#10B981',
  },
  adjActionBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  historySection: {
    marginTop: 30,
    marginBottom: 20,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderStyle: 'dashed',
  },
  emptyHistoryText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '500',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 12,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  historySubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  historyTime: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  historyType: {
    fontSize: 11,
    fontWeight: '700',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#CBD5E1',
  },
  historyAmount: {
    fontSize: 15,
    fontWeight: '800',
  },
  viewHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 15,
  },
  viewHistoryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  detailTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  doneBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  modalScrollArea: {
    maxHeight: 400,
  },
  udhaarCardWide: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  udhaarMainInfo: {
    gap: 8,
  },
  udhaarCardName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  udhaarStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  udhaarStatusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  udhaarCardAmount: {
    fontSize: 26,
    fontWeight: '900',
  },
  udhaarSummaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  udhaarSummaryBox: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  earningSummaryBox: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  earningSummaryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    marginBottom: 15,
  },
  earningSummaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningSummaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  earningSummaryValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
  },
  earningSummaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  earningSummaryFooterText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  addPersonHeroBtn: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: PRIMARY_COLOR,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  addPersonHeroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  addPersonHeroIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPersonHeroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  addPersonHeroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  deleteModalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  deleteIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  deleteTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  deleteSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  deleteActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  deleteCancelBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteCancelText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  deleteConfirmBtn: {
    flex: 1,
    height: 54,
    borderRadius: 16,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalActions: {
    marginTop: 20,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  modalIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  modalInfoText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  addToEarningBtn: {
    backgroundColor: '#10B981',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});

