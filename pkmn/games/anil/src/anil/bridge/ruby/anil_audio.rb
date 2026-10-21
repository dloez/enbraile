module AnilBridge
  FULL_BGM_VOLUME = 100

  @muted = false
  @bgm_volume = FULL_BGM_VOLUME
  @bgs = nil

  def self.muted?
    @muted
  end

  def self.sound_command(client, request)
    muted = request["muted"]
    unless muted.nil?
      raise ArgumentError, "muting needs a client with the control role" unless client[:role] == CONTROL_ROLE
      raise ArgumentError, "muted must be true or false, not #{muted.inspect}" unless muted == true || muted == false
      switch_sound(muted)
    end
    { "muted" => @muted }
  end

  def self.switch_sound(muted)
    return if muted == @muted
    @muted = muted
    Audio.anil_bridge_bgm_set_volume(muted ? 0 : @bgm_volume)
    if @bgs
      name, volume, pitch = @bgs
      Audio.anil_bridge_bgs_play(name, audible(volume), pitch, Audio.bgs_pos)
    end
    log(muted ? "sound muted" : "sound on")
  end

  def self.audible(volume)
    @muted ? 0 : volume
  end

  def self.bgm_volume_set(volume)
    @bgm_volume = volume
    audible(volume)
  end

  def self.bgs_started(name, volume, pitch)
    @bgs = [name, volume, pitch]
  end

  def self.bgs_ended
    @bgs = nil
  end

  def self.start_muted
    @muted = true
    Audio.anil_bridge_bgm_set_volume(0)
    log("sound muted from the start")
  end
end

module Audio
  class << self
    alias_method :anil_bridge_bgm_set_volume, :bgm_set_volume
    def bgm_set_volume(volume, *track)
      return anil_bridge_bgm_set_volume(volume, *track) unless track.empty?
      anil_bridge_bgm_set_volume(AnilBridge.bgm_volume_set(volume))
    end

    alias_method :anil_bridge_bgs_play, :bgs_play
    def bgs_play(name, volume = 100, pitch = 100, *rest)
      AnilBridge.bgs_started(name, volume, pitch)
      anil_bridge_bgs_play(name, AnilBridge.audible(volume), pitch, *rest)
    end

    alias_method :anil_bridge_bgs_stop, :bgs_stop
    def bgs_stop(*args)
      AnilBridge.bgs_ended
      anil_bridge_bgs_stop(*args)
    end

    alias_method :anil_bridge_bgs_fade, :bgs_fade
    def bgs_fade(*args)
      AnilBridge.bgs_ended
      anil_bridge_bgs_fade(*args)
    end

    alias_method :anil_bridge_me_play, :me_play
    def me_play(name, volume = 100, pitch = 100, *rest)
      anil_bridge_me_play(name, AnilBridge.audible(volume), pitch, *rest)
    end

    alias_method :anil_bridge_se_play, :se_play
    def se_play(name, volume = 100, pitch = 100, *rest)
      anil_bridge_se_play(name, AnilBridge.audible(volume), pitch, *rest)
    end
  end
end
