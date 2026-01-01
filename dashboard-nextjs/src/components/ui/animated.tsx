"use client";

import { ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, className = "" }: FadeInProps) {
  return (
    <div
      className={`animate-fade-in animation-fill-backwards ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

interface SlideInProps {
  children: ReactNode;
  direction?: "up" | "left" | "right";
  delay?: number;
  className?: string;
}

export function SlideIn({
  children,
  direction = "up",
  delay = 0,
  className = "",
}: SlideInProps) {
  const animationClass =
    direction === "up"
      ? "animate-slide-in-up"
      : direction === "left"
      ? "animate-slide-in-left"
      : "animate-slide-in-right";

  return (
    <div
      className={`${animationClass} animation-fill-backwards ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

interface StaggeredListProps {
  children: ReactNode[];
  staggerDelay?: number;
  direction?: "up" | "left" | "right";
  className?: string;
}

export function StaggeredList({
  children,
  staggerDelay = 100,
  direction = "up",
  className = "",
}: StaggeredListProps) {
  return (
    <>
      {children.map((child, index) => (
        <SlideIn
          key={index}
          direction={direction}
          delay={index * staggerDelay}
          className={className}
        >
          {child}
        </SlideIn>
      ))}
    </>
  );
}
