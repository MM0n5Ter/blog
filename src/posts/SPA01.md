---
title: 静态程序分析(1)-控制流分析
date: 2023-04-13 15:30:27
tags: [Soot,Program Analysis,Study]
categories: Static-Program-Analysis
description: 南京大学李樾谭添老师的静态分析课，本篇是第一第二节课关于控制流分析，包括课后作业A1
top_img: img/banner/Apr.jpg
cover: img/banner/Apr.jpg
mathjax: true
---

## 前置知识：编译和中间表示

在这里直接简略书写了：

- 编译器：将源码编译成机器码
- 编译器的工作流程：词法分析，语法分析，语义分析，中间代码生成&优化，目标代码生成
- 中间表示包括哟AST（抽象语法树）IR（平台无关中间指令）
- AST：更高层，和语法切合非常近，依赖语言
- IR：更底层，和机器码非常近，不依赖语言

- SSA（静态单赋值）：编译原理当时专门认真学了学，结果不在考试范围内，哭
- Basic Block（基本块）：只有一个入口，一个出口
- CFG（控制流图）

## 概览

- 节点➡BB，边➡控制流
- may analysis & must analysis

## 初步

**输入输出状态：**

- 每一条IR的执行，都会使状态从**输入状态**变成新的**输出状态**
- **transfer function**，前向分析：OUT[s] = $f_s$(IN[s])

**控制流约束：**

- 基础块内
- 基础块间

## Reaching Definition Analysis

> 不涉及：函数调用，变量别名
>
> 后期课程会有对应的：程序间分析，指针分析

### 基本概念

- 假定 x 有定值 d (**definition**)，如果存在一个路径，从紧随 d 的点到达某点 p，并且此路径上面没有 x 的其他定值点，则称 x 的定值 d 到达 (**reaching**) p。（赋值的作用域？）

- 用于检测未定义的变量

  > 栗子：
  >
  > 我们在程序入口为各变量引入一个 dummy 定值。当程序出口的某变量定值依然为 dummy，则我们可以认为该变量未被定义。

- 转移方程：$OUT[B] = gen_B\cup(IN[B]-kill_B)$

  <img src="https://mm0n5ter.github.io/img/SPA/image-20220628152914822.png" style="zoom:33%;" />

- 控制流：$IN[B] = \cup_{P\ a\ predecessor\ of\ B}OUT[P]$

### 算法

```
OUT[entry] = Φ;
for(each basic block B\entry)
	OUT[B] = Φ;					## 此处may一般都为Φ，must一般都为top
while(changes to any OUT occur)
	for(each basic block B\entry){
		控制流方程；
		转移方程；
	}
```

### 栗子

图图如下：

<img src="https://mm0n5ter.github.io/img/SPA/image-20220628155533472.png" style="zoom:33%;" />

运行过程如下：

<img src="https://mm0n5ter.github.io/img/SPA/image-20220628160839274.png" style="zoom:33%;" />

### 安全性分析

**此算法为单调算法，且有上界，则必然会达到不动点**



## Live Variables Analysis

### 基础概念

- 变量 x 在程序点 p 上的值是否会在某条从 p 出发的路径中使用

- 变量 x 在 p 上活跃，当且仅存在一条从 p 开始的路径，该路径的末端使用了 x，且路径上没有对 x进行覆盖。

- 隐藏了这样一个含义：在被使用前，v 没有被重新定义过，即没有被 kill 过。

> 用例：寄存器分配，替换不活跃的值的寄存器

- 控制流：$OUT[B] = \cup_{S\ a\ successor\ of\ B}IN[B]$

- 转移方程：$IN[B]=use_B\cup[OUT[B]-def_B]$

  此处的use要求再define之前use

  ![](img/SPA/image-20220701125550643.png)


### 算法

```
IN[exit] = Φ;
for(each basic block B\exit)
	IN[B] = Φ;
while(changes to any IN occur)
	for(each basic block B\exit){
		控制流方程;
		转移方程;
	}
```

### 栗子

<img src="https://mm0n5ter.github.io/img/SPA/image-20220701130237308.png" style="zoom:33%;" />

<img src="https://mm0n5ter.github.io/img/SPA/image-20220701131402863.png" style="zoom:33%;" />

## Available Expressions Analysis

### 基础概念

- x + y 在 p 点可用的条件：从流图入口结点到达 p 的每条路径都对 x + y 求了值，且在最后一次求值之后**再没有对 x 或 y 赋值**

- 可用表达式可以用于全局公共子表达式的计算。也就是说，如果一个表达式上次计算的值到这次仍然可用，我们就能直接利用其中值，而不用进行再次的计算。

- 转移方程：$OUT[B] = gen_B\cup{IN[B]-kill_B}$

- 控制流：$IN[B]=\cap_{P\ a\ predecessor\ of\ B}OUT[P]$

  > 用例：用于减少冗余计算操作，每个次要用就等于其上一节点中的值

### 算法

```
OUT[entry] = Φ;
for(each basic block B\entry)
	OUT[B] = U;
while(changes to any OUT occur)
	for(each basic block B\entry){
		控制流;
		转移方程;
	}
```

### 栗子

<img src="https://mm0n5ter.github.io/img/SPA/image-20220702145741931.png" style="zoom:33%;" />

<img src="https://mm0n5ter.github.io/img/SPA/image-20220702150656186.png" style="zoom:33%;" />

## 比较

 |                | Reaching Definitions | Live Variables   | Available Expressions |
 | -------------- | -------------------- | ---------------- | --------------------- |
 | Domin          | Set of definitions   | Set of variables | Set of expressions    |
 | Direction      | Forward              | Backward         | Forward               |
 | May/Must       | May                  | May              | Must                  |
 | Boundary       | OUT[entry] = Φ       | IN[exit] = Φ     | OUT[entry] = Φ        |
 | Initialization | OUT[B] = Φ           | IN[B] = Φ        | OUT[B] = ∪            |
 | Transfer       |                      |                  |                       |
 | Meet           | ∪                    | ∪                | ∩                     |

## 课后作业-A1

任务目标：[作业 1：活跃变量分析和迭代求解器 | Tai-e (pascal-lab.net)](https://tai-e.pascal-lab.net/pa1.html)

完成：个人github
