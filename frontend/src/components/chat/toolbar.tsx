"use client";
import cx from "classnames";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { WrenchIcon, XIcon } from "lucide-react";
import { nanoid } from "nanoid";
import {
  type Dispatch,
  memo,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useOnClickOutside } from "usehooks-ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ChatHelpers,
  ChatRunStatus,
  ChatSendMessage,
  ChatSetMessages,
} from "@/lib/chat/chat-helpers";
import { type ArtifactKind, artifactDefinitions } from "./artifact";
import type { ArtifactToolbarItem } from "./create-artifact";
import { ArrowUpIcon, StopIcon, SummarizeIcon } from "./icons";

type ToolProps = {
  description: string;
  icon: ReactNode;
  selectedTool: string | null;
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  isToolbarVisible?: boolean;
  setIsToolbarVisible?: Dispatch<SetStateAction<boolean>>;
  isAnimating: boolean;
  sendMessage: ChatSendMessage;
  onClick: ({ sendMessage }: { sendMessage: ChatSendMessage }) => void;
};

const Tool = ({
  description,
  icon,
  selectedTool,
  setSelectedTool,
  isToolbarVisible,
  setIsToolbarVisible,
  isAnimating,
  sendMessage,
  onClick,
}: ToolProps) => {
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (selectedTool !== description) {
      setIsHovered(false);
    }
  }, [selectedTool, description]);

  const handleSelect = () => {
    if (!isToolbarVisible && setIsToolbarVisible) {
      setIsToolbarVisible(true);
      return;
    }

    if (!selectedTool) {
      setIsHovered(true);
      setSelectedTool(description);
      return;
    }

    if (selectedTool === description) {
      setSelectedTool(null);
      onClick({ sendMessage });
    } else {
      setSelectedTool(description);
    }
  };

  return (
    <Tooltip open={isHovered && !isAnimating}>
      <TooltipTrigger asChild>
        <motion.div
          animate={{ opacity: 1, transition: { delay: 0.1 } }}
          className={cx("rounded-full p-3", {
            "bg-primary text-primary-foreground!": selectedTool === description,
          })}
          exit={{
            opacity: 0,
            scale: 0.9,
            transition: { duration: 0.1 },
          }}
          initial={{ opacity: 0, scale: 1 }}
          onClick={() => {
            handleSelect();
          }}
          onHoverEnd={() => {
            if (selectedTool !== description) {
              setIsHovered(false);
            }
          }}
          onHoverStart={() => {
            setIsHovered(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSelect();
            }
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {selectedTool === description ? <ArrowUpIcon /> : icon}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent
        className="rounded-2xl bg-foreground p-3 px-4 text-background"
        side="left"
        sideOffset={16}
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
};

const randomArr = [...new Array(6)].map((_x) => nanoid(5));

const ReadingLevelSelector = ({
  setSelectedTool,
  sendMessage,
  isAnimating,
}: {
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  isAnimating: boolean;
  sendMessage: ChatSendMessage;
}) => {
  const LEVELS = [
    "Elementary",
    "Middle School",
    "Keep current level",
    "High School",
    "College",
    "Graduate",
  ];

  const y = useMotionValue(-40 * 2);
  const dragConstraints = 5 * 40 + 2;
  const yToLevel = useTransform(y, [0, -dragConstraints], [0, 5]);

  const [currentLevel, setCurrentLevel] = useState(2);
  const [hasUserSelectedLevel, setHasUserSelectedLevel] =
    useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = yToLevel.on("change", (latest) => {
      const level = Math.min(5, Math.max(0, Math.round(Math.abs(latest))));
      setCurrentLevel(level);
    });

    return () => unsubscribe();
  }, [yToLevel]);

  return (
    <div className="relative flex flex-col items-center justify-end">
      {randomArr.map((id) => (
        <motion.div
          animate={{ opacity: 1 }}
          className="flex size-[40px] flex-row items-center justify-center"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={id}
          transition={{ delay: 0.1 }}
        >
          <div className="size-2 rounded-full bg-muted-foreground/40" />
        </motion.div>
      ))}

      <TooltipProvider>
        <Tooltip open={!isAnimating}>
          <TooltipTrigger asChild>
            <motion.div
              className={cx(
                "absolute flex flex-row items-center rounded-full border bg-background p-3",
                {
                  "bg-background text-foreground": currentLevel === 2,
                  "bg-primary text-primary-foreground": currentLevel !== 2,
                }
              )}
              drag="y"
              dragConstraints={{ bottom: 0, top: -dragConstraints }}
              dragElastic={0}
              dragMomentum={false}
              onClick={() => {
                if (currentLevel !== 2 && hasUserSelectedLevel) {
                  sendMessage({
                    parts: [
                      {
                        text: `Please adjust the reading level to ${LEVELS[currentLevel]} level.`,
                        type: "text",
                      },
                    ],
                    role: "user",
                  });

                  setSelectedTool(null);
                }
              }}
              onDragEnd={() => {
                if (currentLevel === 2) {
                  setSelectedTool(null);
                } else {
                  setHasUserSelectedLevel(true);
                }
              }}
              onDragStart={() => {
                setHasUserSelectedLevel(false);
              }}
              style={{ y }}
              transition={{ duration: 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {currentLevel === 2 ? <SummarizeIcon /> : <ArrowUpIcon />}
            </motion.div>
          </TooltipTrigger>
          <TooltipContent
            className="rounded-2xl bg-foreground p-3 px-4 text-background text-sm"
            side="left"
            sideOffset={16}
          >
            {LEVELS[currentLevel]}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export const Tools = ({
  selectedTool,
  setSelectedTool,
  sendMessage,
  isAnimating,
  tools,
}: {
  selectedTool: string | null;
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  sendMessage: ChatSendMessage;
  isAnimating: boolean;
  tools: ArtifactToolbarItem[];
}) => (
  <motion.div
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col gap-1.5"
    exit={{ opacity: 0, scale: 0.95 }}
    initial={{ opacity: 0, scale: 0.95 }}
  >
    {[...tools].reverse().map((tool) => (
      <Tool
        description={tool.description}
        icon={tool.icon}
        isAnimating={isAnimating}
        key={tool.description}
        onClick={tool.onClick}
        selectedTool={selectedTool}
        sendMessage={sendMessage}
        setSelectedTool={setSelectedTool}
      />
    ))}
  </motion.div>
);

const createFixErrorTool = (
  consoleOutput: string,
  documentId?: string
): ArtifactToolbarItem => ({
  description: "Fix error",
  icon: <WrenchIcon className="size-4" />,
  onClick: ({ sendMessage: send }) => {
    send({
      parts: [
        {
          text: `Fix the error in the existing script${documentId ? ` (id: ${documentId})` : ""}. Reply with the full corrected script in a code block. Do not create a new script. Console error:\n\n${consoleOutput}`,
          type: "text",
        },
      ],
      role: "user",
    });
  },
});

const PureToolbar = ({
  isToolbarVisible: _isToolbarVisible,
  setIsToolbarVisible,
  sendMessage,
  status,
  stop,
  setMessages,
  artifactKind,
  consoleError,
  documentId,
  artifactActions,
  artifactInteractBoundaryRef,
  onClose,
}: {
  isToolbarVisible: boolean;
  setIsToolbarVisible: Dispatch<SetStateAction<boolean>>;
  status: ChatRunStatus;
  sendMessage: ChatSendMessage;
  stop: ChatHelpers["stop"];
  setMessages: ChatSetMessages;
  artifactKind: ArtifactKind;
  consoleError?: string;
  documentId?: string;
  artifactActions?: ReactNode;
  artifactInteractBoundaryRef?: RefObject<HTMLElement | null>;
  onClose?: () => void;
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useOnClickOutside(toolbarRef, (event) => {
    const target = event.target;
    if (!(target instanceof Node) || !target.isConnected) {
      return;
    }
    // Spreadsheet/grid: event.target may be a Text node; panel.contains(Text) works.
    if (artifactInteractBoundaryRef?.current?.contains(target)) {
      return;
    }
    const nearestElement =
      target instanceof Element ? target : target.parentElement;
    if (nearestElement?.closest("[data-sheet-editor]")) {
      return;
    }

    setIsToolbarVisible(false);
    setSelectedTool(null);
  });

  const startCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setSelectedTool(null);
      setIsToolbarVisible(false);
    }, 2000);
  };

  const cancelCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (status === "streaming") {
      setIsToolbarVisible(false);
    }
  }, [status, setIsToolbarVisible]);

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifactKind
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  const toolsByArtifactKind = consoleError
    ? [
        createFixErrorTool(consoleError, documentId),
        ...artifactDefinition.toolbar.slice(1),
      ]
    : artifactDefinition.toolbar;

  if (toolsByArtifactKind.length === 0) {
    return null;
  }

  const toolbarTree = (
    <TooltipProvider delayDuration={0}>
      <motion.div
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="pointer-events-auto fixed right-6 bottom-6 z-200 flex cursor-pointer flex-col items-center rounded-3xl bg-background py-1 shadow-lg"
        exit={{ opacity: 0, transition: { duration: 0.1 }, y: -20 }}
        initial={{ opacity: 0, scale: 1, y: -20 }}
        onAnimationComplete={() => {
          setIsAnimating(false);
        }}
        onAnimationStart={() => {
          setIsAnimating(true);
        }}
        onHoverEnd={() => {
          if (status === "streaming") {
            return;
          }

          startCloseTimer();
        }}
        onHoverStart={() => {
          if (status === "streaming") {
            return;
          }

          cancelCloseTimer();
          setIsToolbarVisible(true);
        }}
        ref={toolbarRef}
        transition={{ damping: 25, stiffness: 300, type: "spring" }}
      >
        {onClose && (
          <motion.div
            animate={{ opacity: 1 }}
            className="p-3 text-muted-foreground transition-colors hover:text-foreground"
            initial={{ opacity: 0 }}
            onClick={onClose}
          >
            <XIcon className="size-4" />
          </motion.div>
        )}

        {status === "streaming" ? (
          <motion.div
            animate={{ scale: 1.4 }}
            className="p-3"
            exit={{ scale: 1 }}
            initial={{ scale: 1 }}
            key="stop-icon"
            onClick={() => {
              stop();
              setMessages((messages) => messages);
            }}
          >
            <StopIcon />
          </motion.div>
        ) : selectedTool === "adjust-reading-level" ? (
          <ReadingLevelSelector
            isAnimating={isAnimating}
            key="reading-level-selector"
            sendMessage={sendMessage}
            setSelectedTool={setSelectedTool}
          />
        ) : (
          <>
            {artifactActions}
            <Tools
              isAnimating={isAnimating}
              key="tools"
              selectedTool={selectedTool}
              sendMessage={sendMessage}
              setSelectedTool={setSelectedTool}
              tools={toolsByArtifactKind}
            />
          </>
        )}
      </motion.div>
    </TooltipProvider>
  );

  if (!mounted) {
    return null;
  }

  return createPortal(toolbarTree, document.body);
};

export const Toolbar = memo(PureToolbar, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.isToolbarVisible !== nextProps.isToolbarVisible) {
    return false;
  }
  if (prevProps.artifactKind !== nextProps.artifactKind) {
    return false;
  }
  if (prevProps.consoleError !== nextProps.consoleError) {
    return false;
  }
  if (
    prevProps.artifactInteractBoundaryRef !==
    nextProps.artifactInteractBoundaryRef
  ) {
    return false;
  }
  if (prevProps.artifactActions !== nextProps.artifactActions) {
    return false;
  }
  if (prevProps.onClose !== nextProps.onClose) {
    return false;
  }

  return true;
});
