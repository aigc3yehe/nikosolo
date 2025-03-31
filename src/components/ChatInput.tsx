import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { useAtom } from 'jotai';
import styles from './ChatInput.module.css';
import sendIcon from '../assets/send.svg';
import sendActiveIcon from '../assets/send_activating.svg';
import closeIcon from '../assets/close.svg';
import imageIcon from '../assets/image.svg';
import downIcon from '../assets/down.svg';
import { chatAtom, sendMessage, aspectRatios, AspectRatio, setAspectRatio } from '../store/chatStore';

interface Tag {
  id: string;
  text: string;
  type: 'normal' | 'closeable' | 'imageRatio' | 'lora';
  value?: string;
  ratio?: string;
}

interface ChatInputProps {
  isLoading: boolean;
  disabled: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ isLoading, disabled }) => {
  const [input, setInput] = useState('');
  const [chatState] = useAtom(chatAtom);
  const [, sendMessageAction] = useAtom(sendMessage);
  const [, setAspectRatioAction] = useAtom(setAspectRatio);
  
  const [activeTags, setActiveTags] = useState<Tag[]>([]);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientHeight, setClientHeight] = useState(0);
  const [showRatioDropdown, setShowRatioDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const customScrollbarRef = useRef<HTMLDivElement>(null);
  const ratioDropdownRef = useRef<HTMLDivElement>(null);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 220)}px`;
      
      // 更新滚动条状态
      setScrollHeight(textareaRef.current.scrollHeight);
      setClientHeight(textareaRef.current.clientHeight);
      setScrollTop(textareaRef.current.scrollTop);
    }
  }, [input]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ratioDropdownRef.current && !ratioDropdownRef.current.contains(event.target as Node)) {
        setShowRatioDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 根据task_type设置标签
  useEffect(() => {
    const baseTags: Tag[] = [];
    
    // 如果有task_type且不是chat，则添加Task标签
    if (chatState.task_type && chatState.task_type !== 'chat') {
      baseTags.push({ 
        id: 'task', 
        text: 'Task', 
        type: 'normal', 
        value: chatState.task_type 
      });
    }

    // 如果当前进入到模型详情，则添加Base Model 和 LoraName标签
    if (chatState.currentModel) {
      const models = chatState.currentModel?.model_tran || []
      if (models.length > 0 && models[0].base_model_hash){
        baseTags.push({
          id: 'base_model',
          text: 'Base Model',
          type: 'normal',
          value: models[0].base_model_hash || undefined
        })
      }
      if (models.length > 0 && models[0].lora_name){
        baseTags.push({
          id: 'lora_name',
          text: 'Lora',
          type: 'lora',
          value: models[0].lora_name || undefined 
        }) 
      }
      if (models.length > 0 && models[0].base_model_hash && models[0].lora_name){
        baseTags.push({
          id: 'image_ratio',
          text: 'image',
          type: 'imageRatio',
          ratio: chatState.selectedAspectRatio?.value || '1:1'
        })
      }
    }
    
    setActiveTags(baseTags);
  }, [chatState.task_type, chatState.currentModel, chatState.selectedAspectRatio]);

  // 监听textarea的滚动事件
  const handleTextareaScroll = () => {
    if (textareaRef.current) {
      setScrollTop(textareaRef.current.scrollTop);
    }
  };

  // 处理标签删除
  const handleTagDelete = (tagId: string) => {
    setActiveTags(prev => prev.filter(tag => tag.id !== tagId));
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const message = input.trim();
    setInput('');
    await sendMessageAction(message);
  };

  // 处理按键事件
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 处理宽高比选择
  const handleAspectRatioSelect = (ratio: AspectRatio) => {
    setAspectRatioAction(ratio);
    setShowRatioDropdown(false);
  };

  // 处理宽高比标签点击
  const handleRatioTagClick = () => {
    setShowRatioDropdown(prev => !prev);
  };

  // 处理自定义滚动条拖动
  const handleScrollThumbDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const startY = e.clientY;
    const startScrollTop = scrollTop;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (textareaRef.current) {
        const deltaY = moveEvent.clientY - startY;
        const scrollRatio = deltaY / clientHeight;
        const newScrollTop = startScrollTop + scrollRatio * scrollHeight;
        
        textareaRef.current.scrollTop = newScrollTop;
        setScrollTop(textareaRef.current.scrollTop);
      }
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 计算滚动条高度和位置
  const getScrollThumbHeight = () => {
    if (scrollHeight <= clientHeight) return 0;
    return Math.max(30, (clientHeight / scrollHeight) * clientHeight);
  };
  
  const getScrollThumbTop = () => {
    if (scrollHeight <= clientHeight) return 0;
    return (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - getScrollThumbHeight());
  };

  // 显示自定义滚动条的条件
  const showCustomScrollbar = scrollHeight > clientHeight;

  return (
    <div className={styles.bottomContainer}>
      {/* 实时标签组件 */}
      {activeTags.length > 0 && (
        <div className={styles.tagsContainer}>
          {activeTags.map(tag => {
            if (tag.type === 'closeable') {
              return (
                <div key={tag.id} className={styles.tagWithClose}>
                  <img 
                    src={closeIcon} 
                    alt="Close" 
                    className={styles.closeIcon}
                    onClick={() => handleTagDelete(tag.id)}
                  />
                  <span className={styles.text}>{tag.text}</span>
                  <span className={styles.value}>{tag.value}</span>
                </div>
              );
            } else if (tag.type === 'imageRatio') {
              return (
                <div 
                  key={tag.id} 
                  className={styles.imageRatioTag}
                  onClick={handleRatioTagClick}
                  ref={ratioDropdownRef}
                >
                  <img src={imageIcon} alt="Image" className={styles.leftIcon} />
                  <span className={styles.ratioText}>{tag.ratio}</span>
                  <img src={downIcon} alt="Down" className={styles.rightIcon} />
                  
                  {/* 宽高比下拉菜单 */}
                  {showRatioDropdown && (
                    <div className={styles.ratioDropdown}>
                      {aspectRatios.map((ratio) => (
                        <div 
                          key={ratio.value}
                          className={`${styles.ratioItem} ${chatState.selectedAspectRatio?.value === ratio.value ? styles.ratioItemSelected : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAspectRatioSelect(ratio);
                          }}
                        >
                          {ratio.label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            } else if (tag.type === 'lora') {
              return (
                <div key={tag.id} className={styles.tag}>
                  <span className={styles.text}>{tag.text}</span>
                  <span className={styles.value}>{tag.value}</span>
                </div>
              );
            } else {
              return (
                <div key={tag.id} className={styles.tag}>
                  <span className={styles.text}>{tag.text}</span>
                  <span className={styles.value}>{tag.value}</span>
                </div>
              );
            }
          })}
        </div>
      )}

      {/* 输入框组件 */}
      <div className={`${styles.inputContainer} ${input ? styles.hasContent : ''}`}>
        <div className={styles.textareaWrapper}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onScroll={handleTextareaScroll}
            placeholder="Write something here..."
            rows={1}
            className={styles.hideScrollbar}
          />
          <div className={styles.sendButtonContainer}>
            <button
              className={styles.sendButton}
              onClick={handleSendMessage}
              disabled={!input.trim() || isLoading || disabled}
            >
              <img src={input.trim() ? sendActiveIcon : sendIcon} alt="Send" />
            </button>
          </div>
        </div>
        
        {/* 自定义滚动条 */}
        {showCustomScrollbar && (
          <div className={styles.customScrollbarTrack}>
            <div 
              ref={customScrollbarRef}
              className={styles.customScrollbarThumb}
              style={{
                height: `${getScrollThumbHeight()}px`,
                top: `${getScrollThumbTop()}px`
              }}
              onMouseDown={handleScrollThumbDrag}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInput;