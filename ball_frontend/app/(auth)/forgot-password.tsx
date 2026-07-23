import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, type Href } from 'expo-router';
import { useThemeColors } from '../../src/hooks/useThemeColors';

const STEPS = ['Email', 'Code', 'New Password', 'Done'];

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState(0);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const c = useThemeColors();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: step / (STEPS.length - 1),
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [step]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResend = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setLoading(false);
    setResendCooldown(30);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const goTo = (next: number) => {
    setError('');
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: next > step ? 20 : -20, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    });
  };

  const isStepValid = () => {
    if (step === 0) return email.includes('@') && email.includes('.');
    if (step === 1) return code.every(d => d !== '');
    if (step === 2) return password.length >= 8 && password === confirmPassword;
    return false;
  };

  const handleNext = async () => {
    if (!isStepValid()) {
      if (step === 0) setError('Please enter a valid email address.');
      else if (step === 1) setError('Please enter the full 6-digit code.');
      else if (step === 2) {
        if (password.length < 8) setError('Password must be at least 8 characters.');
        else if (password !== confirmPassword) setError('Passwords do not match.');
      }
      return;
    }
    setError('');
    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (step === 0) {
      await new Promise(r => setTimeout(r, 1200));
      setLoading(false);
      setSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }

    if (step === 2) {
      await new Promise(r => setTimeout(r, 1500));
      setLoading(false);
      goTo(3);
      return;
    }

    setLoading(false);
    goTo(step + 1);
  };

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    if (value && index < 5) {
      const input = document.getElementById(`fp-digit-${index + 1}`);
      input?.focus();
    }
  };

  const handleDigitKey = (index: number, e: any) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      const input = document.getElementById(`fp-digit-${index - 1}`);
      input?.focus();
    }
  };

  const renderStepIndicator = () => (
    <View style={{ marginBottom: 28 }}>
      {/* Animated progress bar */}
      <View style={{ height: 3, backgroundColor: c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 20 }}>
        <Animated.View style={{
          height: 3,
          borderRadius: 2,
          backgroundColor: c.primary,
          width: '100%',
          transform: [{ scaleX: progressAnim }],
        }} />
      </View>

      {/* Step chips */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isComplete = i < step;
          return (
            <View
              key={s}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: isActive ? 14 : 0,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: isActive
                  ? c.primary
                  : isComplete
                    ? (c.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.04)')
                    : 'transparent',
                shadowColor: isActive ? c.primary : 'transparent',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isActive ? 0.35 : 0,
                shadowRadius: isActive ? 8 : 0,
                elevation: isActive ? 4 : 0,
              }}
            >
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive
                  ? 'rgba(255,255,255,0.25)'
                  : isComplete
                    ? c.primary
                    : (c.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
              }}>
                {isComplete ? (
                  <Ionicons name="checkmark" size={13} color="#fff" />
                ) : (
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: isActive ? '#fff' : c.muted,
                  }}>{i + 1}</Text>
                )}
              </View>
              {isActive && (
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff', marginRight: 2 }}>{s}</Text>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderEmailStep = () => (
    <View>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: c.text, marginBottom: 4, letterSpacing: -0.5 }}>Forgot password?</Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted, marginBottom: 24 }}>
          No worries — we'll send a reset code to your inbox.
        </Text>
      </View>
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 8 }}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={c.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={{
            width: '100%',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            fontSize: 14,
            fontWeight: '500',
            color: c.text,
            backgroundColor: c.surface,
            borderWidth: 1.5,
            borderColor: c.border,
          }}
        />
      </View>
      {error ? (
        <View style={{
          backgroundColor: c.isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
          borderWidth: 1,
          borderColor: c.isDark ? '#7f1d1d' : '#fecaca',
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
          <Text style={{ fontSize: 14 }}>⚠</Text>
          <Text style={{ color: c.isDark ? '#fca5a5' : '#b91c1c', fontSize: 13, fontWeight: '500', flex: 1 }}>{error}</Text>
        </View>
      ) : null}
      <TouchableOpacity
        style={{
          backgroundColor: c.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: c.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        }}
        onPress={handleNext}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? <ActivityIndicator color="#fff" size={17} /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Send Reset Code</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderSentStep = () => (
    <View>
      <View style={{
        width: 56, height: 56, borderRadius: 16,
        backgroundColor: c.isDark ? 'rgba(22,163,74,0.15)' : '#dcfce7',
        alignItems: 'center', justifyContent: 'center', marginBottom: 20,
      }}>
        <Text style={{ fontSize: 28 }}>📬</Text>
      </View>
      <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 6, letterSpacing: -0.5 }}>Check your inbox</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted, lineHeight: 20, marginBottom: 24 }}>
        We sent a 6-digit code to <Text style={{ fontWeight: '700', color: c.text }}>{email}</Text>. It expires in 15 minutes.
      </Text>

      <TouchableOpacity
        style={{
          backgroundColor: c.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: c.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
          marginBottom: 12,
        }}
        onPress={() => goTo(2)}
        activeOpacity={0.85}
      >
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>I've got the code →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1.5,
          borderColor: c.border,
          flexDirection: 'row',
          gap: 8,
        }}
        onPress={handleResend}
        disabled={loading || resendCooldown > 0}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color={c.primary} />
        ) : (
          <>
            <Ionicons name="refresh" size={16} color={c.primary} />
            <Text style={{ color: c.primary, fontSize: 14, fontWeight: '600' }}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
            </Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={{ fontSize: 12, color: c.muted, textAlign: 'center', marginTop: 16, fontWeight: '500' }}>
        Can't find it? Check your spam folder.
      </Text>
    </View>
  );

  const renderCodeStep = () => {
    const strength = [/.{8,}/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(r => r.test(password)).length;
    const strengthColors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#16a34a'];
    const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

    return (
      <View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: c.text, marginBottom: 4, letterSpacing: -0.5 }}>Enter your code</Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted, marginBottom: 24, lineHeight: 20 }}>
          Enter the 6-digit code from your email, then set your new password.
        </Text>

        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 10 }}>Verification code</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {code.map((digit, i) => (
              <TextInput
                key={i}
                id={`fp-digit-${i}`}
                style={{
                  flex: 1,
                  height: 48,
                  textAlign: 'center',
                  fontSize: 20,
                  fontWeight: '800',
                  borderRadius: 12,
                  color: c.text,
                  backgroundColor: c.surface,
                  borderWidth: digit ? 2 : 1.5,
                  borderColor: digit ? c.primary : c.border,
                }}
                value={digit}
                onChangeText={(val) => handleDigit(i, val)}
                onKeyPress={({ nativeEvent }) => handleDigitKey(i, nativeEvent)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
              />
            ))}
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 10 }}>New password</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 8 characters"
              placeholderTextColor={c.muted}
              secureTextEntry={!showPassword}
              style={{
                width: '100%',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 14,
                fontWeight: '500',
                color: c.text,
                backgroundColor: c.surface,
                borderWidth: 1.5,
                borderColor: c.border,
                paddingRight: 48,
              }}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
            >
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.muted} />
            </TouchableOpacity>
          </View>
          {password.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[1, 2, 3, 4].map(i => (
                  <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= strength ? strengthColors[strength] : c.border }} />
                ))}
              </View>
              <Text style={{ fontSize: 12, fontWeight: '600', marginTop: 6, color: strength > 0 ? strengthColors[strength] : c.muted }}>
                {strengthLabels[strength]}
              </Text>
            </View>
          )}
        </View>

        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: c.text, marginBottom: 10 }}>Confirm new password</Text>
          <View style={{ position: 'relative' }}>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Repeat new password"
              placeholderTextColor={c.muted}
              secureTextEntry={!showConfirm}
              style={{
                width: '100%',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 14,
                fontSize: 14,
                fontWeight: '500',
                color: c.text,
                backgroundColor: c.surface,
                borderWidth: 1.5,
                borderColor: c.border,
                paddingRight: 48,
              }}
            />
            <TouchableOpacity
              onPress={() => setShowConfirm(!showConfirm)}
              style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
            >
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={c.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {error ? (
          <View style={{
            backgroundColor: c.isDark ? 'rgba(239,68,68,0.15)' : '#fef2f2',
            borderWidth: 1,
            borderColor: c.isDark ? '#7f1d1d' : '#fecaca',
            borderRadius: 12,
            padding: 12,
            marginBottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <Text style={{ fontSize: 14 }}>⚠</Text>
            <Text style={{ color: c.isDark ? '#fca5a5' : '#b91c1c', fontSize: 13, fontWeight: '500', flex: 1 }}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={{
            backgroundColor: c.primary,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: c.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
          }}
          onPress={handleNext}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? <ActivityIndicator color="#fff" size={17} /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Reset Password</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  const renderSuccessStep = () => {
    const [countdown, setCountdown] = useState(5);
    useEffect(() => {
      if (countdown <= 0) { router.replace('/(auth)/login' as Href); return; }
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }, [countdown]);

    return (
      <View style={{ alignItems: 'center' }}>
        <View style={{
          width: 72, height: 72, borderRadius: 20,
          backgroundColor: c.primary,
          alignItems: 'center', justifyContent: 'center', marginBottom: 24,
          shadowColor: c.primary, shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.4, shadowRadius: 16, elevation: 12,
        }}>
          <Ionicons name="lock-open" size={36} color="#fff" />
        </View>
        <Text style={{ fontSize: 26, fontWeight: '800', color: c.text, marginBottom: 8, letterSpacing: -0.5, textAlign: 'center' }}>You're back on the pitch!</Text>
        <Text style={{ fontSize: 14, fontWeight: '500', color: c.muted, textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>
          Your password has been reset successfully. You can now sign in with your new password.
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: c.primary,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            shadowColor: c.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 6,
            marginBottom: 12,
          }}
          onPress={() => router.replace('/(auth)/login' as Href)}
          activeOpacity={0.85}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Back to Sign In</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 13, fontWeight: '500', color: c.muted }}>
          Redirecting automatically in <Text style={{ fontWeight: '700', color: c.primary }}>{countdown}s</Text>
        </Text>
      </View>
    );
  };

  const currentStep = () => {
    switch (step) {
      case 0: return renderEmailStep();
      case 1: return renderSentStep();
      case 2: return renderCodeStep();
      case 3: return renderSuccessStep();
      default: return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: mounted ? fadeAnim : 0, transform: [{ translateY: slideAnim }] }}>
            <TouchableOpacity onPress={() => router.back()} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 }}>
              <Ionicons name="chevron-back" size={20} color={c.muted} />
              <Text style={{ fontSize: 14, color: c.muted, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>

            {renderStepIndicator()}

            {currentStep()}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
