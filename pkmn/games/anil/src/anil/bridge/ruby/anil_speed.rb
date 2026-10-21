module AnilBridge
  SPEED_FILE = __FILE__
  SPEEDS = ["1x", "2x", "max"]
  SPEED_SCALES = { "1x" => 1, "2x" => 2, "max" => 8 }
  MAX_UPTIME_STEP = 0.2
  UPTIME_START = 1.0
  OWNER_SPEED = "1x"
  DRIVEN_SPEED = "max"
  RENDER_INTERVAL = 1.0 / 30
  IDLE_MS = 1
  PAUSE_ACTIONS = ["pause", "resume", "step"]

  @speed = OWNER_SPEED
  @driven_speed = DRIVEN_SPEED
  @uptime = UPTIME_START
  @uptime_step = nil
  @next_render = nil
  @renders = 0
  @paused_by = nil
  @step = false

  def self.speed_command(client, request)
    preset = request["preset"]
    unless preset.nil?
      raise ArgumentError, "setting the speed needs a client with the control role" unless client[:role] == CONTROL_ROLE
      raise ArgumentError, "speed preset must be one of #{SPEEDS.join(', ')}, not #{preset.inspect}" unless SPEEDS.include?(preset)
      @driven_speed = preset if driven?
      switch_speed(preset)
    end
    { "speed" => @speed, "renders" => @renders }
  end

  def self.pause_command(client, request)
    raise ArgumentError, "pausing needs a client with the control role" unless client[:role] == CONTROL_ROLE
    case request["action"]
    when "pause"
      raise ArgumentError, "a snapshot save or restore is running; pause once it ends" if restoring?
      log("client #{client[:sock]} pauses") unless paused?
      @paused_by = client
    when "resume"
      resume("client #{client[:sock]} resumes")
    when "step"
      raise ArgumentError, "step needs a paused game" unless paused?
      raise ArgumentError, "nothing to step: the game waits for a driver's advance" if waiting_for_driver?
      @step = true
    else
      raise ArgumentError, "pause action must be one of #{PAUSE_ACTIONS.join(', ')}, not #{request['action'].inspect}"
    end
    { "paused" => paused? }
  end

  def self.paused?
    !@paused_by.nil?
  end

  def self.pause_gate?
    paused? && !@step
  end

  def self.end_step
    @step = false
  end

  def self.resume(reason)
    return unless paused?
    @paused_by = nil
    @step = false
    log(reason)
  end

  def self.release_pause(client)
    resume("pausing client #{client[:sock]} left; resumed") if client.equal?(@paused_by)
  end

  def self.control_changed(was_driven)
    now = driven?
    return if now == was_driven
    record("control", "driven" => now)
    switch_speed(now ? @driven_speed : OWNER_SPEED)
  end

  def self.switch_speed(preset)
    return if preset == @speed
    @speed = preset
    @next_render = nil
    log("speed #{preset}")
    record("speed", "speed" => preset)
  end

  def self.start_speed(preset)
    raise ArgumentError, "snapshot speed must be one of #{SPEEDS.join(', ')}, not #{preset.inspect}" unless SPEEDS.include?(preset)
    @speed = preset
    @next_render = nil
    log("speed #{preset} from the boot snapshot")
  end

  def self.uptime
    @uptime
  end

  def self.uptime_step
    @uptime_step || next_uptime_step
  end

  def self.next_uptime_step
    [SPEED_SCALES[@speed].to_f / Graphics.frame_rate, MAX_UPTIME_STEP].min
  end

  def self.advance_uptime
    @uptime_step = next_uptime_step
    @uptime += @uptime_step
  end

  def self.restore_uptime(value)
    @uptime = value
  end

  def self.render_due?
    if @speed == "max"
      now = seconds
      return false if @next_render && now < @next_render
      @next_render = @next_render && now - @next_render < RENDER_INTERVAL ? @next_render + RENDER_INTERVAL : now + RENDER_INTERVAL
    end
    @renders += 1
    true
  end

  def self.idle
    sleep(IDLE_MS / 1000.0)
  end

  def self.seconds
    Process.clock_gettime(Process::CLOCK_MONOTONIC)
  end

  def self.install_speed_hooks
    return unless Object.const_defined?(:SPEEDUP_STAGES)
    hook("turbo SPEEDUP_STAGES") { SPEEDUP_STAGES.fill(1) }
    hook("turbo toggle") do
      singleton = class << Input; self; end
      singleton.send(:alias_method, :anil_bridge_turbo_update, :update)
      singleton.send(:define_method, :update) do |*args|
        $CanToggle = false
        anil_bridge_turbo_update(*args)
      end
    end
  end
end

module System
  class << self
    alias_method :anil_bridge_uptime, :uptime
    def uptime
      AnilBridge.uptime
    end
  end
end

module Graphics
  class << self
    if method_defined?(:delta)
      alias_method :anil_bridge_delta, :delta
      def delta
        AnilBridge.uptime_step
      end
    end

    if method_defined?(:average_frame_rate)
      alias_method :anil_bridge_average_frame_rate, :average_frame_rate
      def average_frame_rate
        1.0 / AnilBridge.uptime_step
      end
    end
  end
end
