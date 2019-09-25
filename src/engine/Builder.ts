import { Name, Command, EnterObjectCommand, LeaveObjectCommand, IntCommand, Context, StrCommand, LongCommand, ByteCommand, CondCommand, EnterArrayCommand, LeaveArrayCommand, FloatCommand, EnterElemCommand, LeaveElemCommand, ExecCommand, BufferStartCommand, BufferEndCommand, SwitchCommand, BreakCommand, DebuggerCommand, HexCommand, AssertNullByteCommand, CallCommand, HexRemainingCommand, LoopBodyCommand, LoopHeaderCommand } from './commands';

export let functionCommands: { [id: string]: Command[] } = {};

export class Builder {
  private commands: Command[] = [];

  public getCommands(): Command[] {
    return this.commands;
  }

  /**
   * Descend down into an object
   * @param name name of the variable
   */
  public obj(name: string): Builder {
    this.commands.push(new EnterObjectCommand(name));
    return this;
  }
  /**
   * Ascend back up to the parent object
   */
  public endObj(): Builder {
    this.commands.push(new LeaveObjectCommand());
    return this;
  }

  /**
   * Descend down into an array
   * @param name name of the variable
   */
  public arr(name: string): Builder {
    this.commands.push(new EnterArrayCommand(name));
    return this;
  }
  /**
   * Ascend back up to the parent object
   */
  public endArr(): Builder {
    this.commands.push(new LeaveArrayCommand());
    return this;
  }

  /**
   * Ascend down into an array
   * @param index index in the array
   */
  public elem(index: Name): Builder {
    this.commands.push(new EnterElemCommand(index));
    return this;
  }

  /**
   * Ascend back up to the parent of the array
   */
  public endElem(): Builder {
    this.commands.push(new LeaveElemCommand());
    return this;
  }

  public int(name: Name, defaultValue?: (ctx: Context) => number, shouldCount = true): Builder {
    this.commands.push(new IntCommand(name, defaultValue, shouldCount));
    return this;
  }
  public str(name: Name, shouldCount = true): Builder {
    this.commands.push(new StrCommand(name, shouldCount));
    return this;
  }
  public long(name: Name): Builder {
    this.commands.push(new LongCommand(name));
    return this;
  }
  public byte(name: Name, shouldCount = true): Builder {
    this.commands.push(new ByteCommand(name, shouldCount));
    return this;
  }
  public float(name: Name): Builder {
    this.commands.push(new FloatCommand(name));
    return this;
  }
  public hex(name: Name, bytes: number, shouldCount = true): Builder {
    this.commands.push(new HexCommand(name, bytes, shouldCount));
    return this;
  }

  public assertNullByte(shouldCount = true): Builder {
    this.commands.push(new AssertNullByteCommand(shouldCount));
    return this;
  }


  public call(rulesFunction: (builder: Builder) => void) {
    if (rulesFunction.name === '') {
      throw new Error('call() can only be used with named functions');
    }

    // Only build each function once
    if (functionCommands[rulesFunction.name] === undefined) {
      console.log('building', rulesFunction.name);
      // Already set this, so that we don't get into infinite recursion
      functionCommands[rulesFunction.name] = [];

      const builder = new Builder();
      rulesFunction(builder);
      functionCommands[rulesFunction.name] = builder.getCommands();
    }
    this.commands.push(new CallCommand(rulesFunction.name));
    return this;
  }
  /**
   * Execute arbitrary javascript code when the TransformEngine gets to this point
   * @param code 
   */
  public exec(code: (ctx: Context) => void) {
    this.commands.push(new ExecCommand(code));
    return this;
  }

  public debug(text: string, code: (ctx: Context) => any) {
    this.commands.push(new ExecCommand(ctx => console.log(text, code(ctx))));
    return this;
  }

  public debugger() {
    this.commands.push(new DebuggerCommand());
    return this;
  }

  public error(message: (ctx: Context) => string) {
    this.commands.push(new ExecCommand(ctx => { throw new Error(message(ctx)); }));
    return this;
  }


  /**
   * Do two different things depending on the condition
   * @param cond 
   * @param thenBranch 
   * @param elseBranch 
   */
  public if(cond: (ctx: Context) => boolean,
    thenBranch: (builder: Builder) => void,
    elseBranch?: (builder: Builder) => void): Builder {
    const thenBuilder = new Builder();
    thenBranch(thenBuilder);
    let elseBuilder = undefined;
    if (elseBranch !== undefined) {
      elseBuilder = new Builder();
      elseBranch(elseBuilder);
    }

    this.commands.push(new CondCommand(cond,
      thenBuilder.getCommands(),
      elseBuilder === undefined ? undefined : elseBuilder.getCommands()))
    return this;
  }

  /**
   * Does the same thing a couple of times.
   * Inside the loopBody, _index will be set to the current index
   * @param times 
   * @param loopBody 
   */
  public loop(times: Name, loopBody: (builder: Builder) => void): Builder {
    const loopBodyBuilder = new Builder();
    loopBody(loopBodyBuilder);
    this.commands.push(new LoopHeaderCommand(times));
    this.commands.push(new LoopBodyCommand(loopBodyBuilder.getCommands()));
    return this;
  }

  public bufferStart(name: Name, resetBytesRead: boolean): Builder {
    this.commands.push(new BufferStartCommand(name, resetBytesRead));
    return this;
  }

  public bufferEnd(): Builder {
    this.commands.push(new BufferEndCommand());
    return this;
  }

  public hexRemaining(name: Name, lengthVar: Name): Builder {
    this.commands.push(new HexRemainingCommand(name, lengthVar));
    return this;
  }

  public switch(name: Name, cases: { [id: string]: (builder: Builder) => void }): Builder {
    const casesCommands: { [id: string]: Command[] } = {};
    for (const key of Object.keys(cases)) {
      const builder = new Builder();
      cases[key](builder);
      casesCommands[key] = builder.getCommands();
    }
    this.commands.push(new SwitchCommand(name, casesCommands))
    return this;
  }

  public break(): Builder {
    this.commands.push(new BreakCommand());
    return this;
  }
}