import { useState, useRef, useEffect } from 'react'
import { Send, Search, Plus, Users, ArrowLeft } from 'lucide-react'
import { CONVERSATIONS, CURRENT_USER, formatTime } from '../utils/mock'
import clsx from 'clsx'

function ConversationItem({ conv, active, onClick }) {
  const name = conv.conversation_type === 'direct' ? conv.other_user.first_name + ' ' + conv.other_user.last_name : conv.name
  const avatar = conv.conversation_type === 'direct' ? conv.other_user.avatar : null

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
        active && 'bg-green-50 dark:bg-green-950/30 border-r-2 border-green-500'
      )}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-10 h-10 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center shrink-0">
          <Users size={18} className="text-green-600 dark:text-green-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm truncate" style={{ color: 'var(--text)' }}>{name}</span>
          <span className="text-xs text-muted shrink-0">{formatTime(conv.last_message.created_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-muted truncate">{conv.last_message.content}</span>
          {conv.unread_count > 0 && (
            <span className="shrink-0 bg-green-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {conv.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

function MessageBubble({ msg, isOwn }) {
  return (
    <div className={clsx('flex gap-2 mb-3', isOwn ? 'flex-row-reverse' : 'flex-row')}>
      {!isOwn && (
        <img
          src={msg.sender.avatar}
          alt={msg.sender.username}
          className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5"
        />
      )}
      <div className={clsx('max-w-[70%] flex flex-col', isOwn ? 'items-end' : 'items-start')}>
        {!isOwn && (
          <span className="text-xs text-muted font-medium mb-1 ml-1">
            {msg.sender.first_name}
          </span>
        )}
        <div
          className={clsx(
            'px-3.5 py-2 rounded-2xl text-sm font-medium leading-relaxed',
            isOwn
              ? 'bg-green-600 text-white rounded-tr-sm'
              : 'rounded-tl-sm'
          )}
          style={isOwn ? {} : { background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--border)' }}
        >
          {msg.content}
        </div>
        <span className="text-[10px] text-muted mt-1 mx-1">{formatTime(msg.created_at)}</span>
      </div>
    </div>
  )
}

export default function Chat() {
  const [conversations, setConversations] = useState(CONVERSATIONS)
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const bottomRef = useRef(null)
  const [showList, setShowList] = useState(true)

  const active = conversations.find(c => c.id === activeId)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [active?.messages?.length])

  const sendMessage = (e) => {
    e.preventDefault()
    if (!input.trim() || !activeId) return
    const msg = {
      id: Date.now(),
      sender: CURRENT_USER,
      content: input.trim(),
      created_at: new Date().toISOString(),
    }
    setConversations(cs => cs.map(c => c.id === activeId
      ? { ...c, messages: [...c.messages, msg], last_message: msg, unread_count: 0 }
      : c
    ))
    setInput('')
  }

  const openConv = (conv) => {
    setActiveId(conv.id)
    setShowList(false)
    setConversations(cs => cs.map(c => c.id === conv.id ? { ...c, unread_count: 0 } : c))
  }

  const activeName = active
    ? active.conversation_type === 'direct'
      ? `${active.other_user.first_name} ${active.other_user.last_name}`
      : active.name
    : ''

  const filteredConvs = conversations.filter(c => {
    const name = c.conversation_type === 'direct' ? `${c.other_user.first_name} ${c.other_user.last_name}` : c.name
    return !search || name.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <div className="flex h-[calc(100vh-0px)] lg:h-screen max-h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      {/* Sidebar */}
      <div
        className={clsx(
          'flex flex-col border-r w-full lg:w-72 shrink-0',
          !showList && 'hidden lg:flex'
        )}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold" style={{ color: 'var(--text)' }}>Messages</h2>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-muted hover:text-green-600 transition-colors">
              <Plus size={18} />
            </button>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input pl-9 text-sm py-2"
              placeholder="Search messages…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConvs.map(conv => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              active={activeId === conv.id}
              onClick={() => openConv(conv)}
            />
          ))}
        </div>
      </div>

      {/* Chat panel */}
      {active ? (
        <div className={clsx('flex-1 flex flex-col min-w-0', showList && 'hidden lg:flex')}>
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3.5 border-b"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-muted"
              onClick={() => setShowList(true)}
            >
              <ArrowLeft size={18} />
            </button>
            {active.conversation_type === 'direct' ? (
              <img src={active.other_user.avatar} alt={activeName} className="w-9 h-9 rounded-full object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                <Users size={16} className="text-green-600 dark:text-green-400" />
              </div>
            )}
            <div>
              <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{activeName}</p>
              <p className="text-xs text-green-500 font-medium">Online</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {active.messages.map(msg => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isOwn={msg.sender.id === CURRENT_USER.id || msg.sender.username === CURRENT_USER.username}
              />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={sendMessage}
            className="flex items-center gap-2 px-4 py-3 border-t"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <input
              className="input flex-1 py-2.5"
              placeholder="Type a message…"
              value={input}
              onChange={e => setInput(e.target.value)}
              autoFocus
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="w-10 h-10 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
            >
              <Send size={16} className="text-white" />
            </button>
          </form>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center text-center text-muted">
          <div>
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-4">
              <Send size={28} className="text-green-500" />
            </div>
            <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>Your Messages</p>
            <p className="text-sm mt-1">Select a conversation to start chatting.</p>
          </div>
        </div>
      )}
    </div>
  )
}
