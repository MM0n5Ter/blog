---
title: MRctf2021 Crypto方向
date: 2021-04-10 15:32:44
tags: [MRctf,Crypto,旧地狱]
categories: 旧地狱
mathjax: true
---

# friendly_sign-in

白给签到题，虽然我做了好久（

*呜呜呜我好菜*

给了一个nc接口和task.py

```python
from Crypto.Util.number import *
from hashlib import sha512
from random import choices
from flag import flag
import string

Bits = 512
length = len(flag) * 8

def proof_of_work() -> bool:
    alphabet = string.ascii_letters + string.digits
    head = "".join(choices(alphabet, k=8))
    print(f'POW: SHA512("{head}" + ?) starts with "11111"')
    tail = input().strip()
    message = (head + tail).encode()
    return sha512(message).hexdigest().startswith("11111")

def check_ans(_N, _x) -> bool:
    check = 0
    for i in range(len(_N)):
        check += _N[i] * _x[i]
    return check == 0

def main():
    if not proof_of_work():
        return
    print("Welcome to MRCTF2021, enjoy this friendly sign-in question~")
    flag_bits = bin(bytes_to_long(flag.encode()))[2:]
    N = [getPrime(Bits) for _ in range(length)]
    print('N =', N)
    X = []
    for i in range(length):
        x = [int(input().strip()) for _ in range(length)]
        if x in X:
            print('No cheat!')
            return
        if x.count(0) > 0:
            print('No trivial!')
            return
        if not check_ans(N, x):
            print('Follow the rule!')
            return
        X.append(x)
        print('your gift:', flag_bits[i])

main()
```

nc接口连进去，先是一个sha512的暴力解密

然后是一个初见觉得很怪异的方程：
$$
\Sigma a_ix_i=0
$$
其中$a_i$为224个512位的大素数

然后需要解出224组~~做完后发现其实只要223组~~不同的解

一开始的想法为$x_i=(-1)^i lcm(a_i)\div a_i$，然后224组就每组乘上一个不同的系数，然后时间炸了。。。

然后想出两两配对相消，然后只让一组乘系数来保证不同解，成功搞出flag

*确实是一道签到难度的💧题，得亏我卡了那么久*

### Exp

```python
text = path.recvline().decode()
tem = text.split('"')
print(text)
path.sendline(sign_in(tem[1]))
text = path.recvline()
text = path.recvline().decode().split(",")
text[0] = text[0][5:]
text[-1] = text[-1][:-2]
sum = 1
lib = []
for i in range(length):
    lib.append(int(text[i]))

flag_bin = ''
for j in range(length-1): #此处的-1是因为做满224次后会因为223次输出后就断开连接而报错
    path.sendline(str(0 - (j + 1) * lib[1]).encode())
    path.sendline(str((j + 1) * lib[0]).encode())
    for i in range(2, length):
        if i % 2 == 0:
            path.sendline(str(0 - lib[i + 1]).encode())
        if i % 2 == 1:
            path.sendline(str(lib[i - 1]).encode())
    text = path.recvline().decode()
    print(text)
    flag_bin = flag_bin + text[-2:-1]
    print(flag_bin)

flag = long_to_bytes(int(flag_bin, 2))
print(flag)
```