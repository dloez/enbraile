module AnilJSON
  class ParseError < StandardError
  end

  ESCAPES = { "\"" => "\\\"", "\\" => "\\\\", "\n" => "\\n", "\r" => "\\r", "\t" => "\\t", "\b" => "\\b", "\f" => "\\f" }
  UNESCAPES = { "\"" => "\"", "\\" => "\\", "/" => "/", "n" => "\n", "r" => "\r", "t" => "\t", "b" => "\b", "f" => "\f" }
  NUMBER = /\A-?\d+(\.\d+)?([eE][+-]?\d+)?/

  def self.encode(value)
    case value
    when nil then "null"
    when true then "true"
    when false then "false"
    when Integer then value.to_s
    when Float then (value.nan? || value.infinite?) ? "null" : value.to_s
    when String then encode_string(value)
    when Symbol then encode_string(value.to_s)
    when Array then "[" + value.map { |item| encode(item) }.join(",") + "]"
    when Hash then "{" + value.map { |key, item| encode_string(key.to_s) + ":" + encode(item) }.join(",") + "}"
    else encode_string(value.inspect)
    end
  end

  def self.utf8(text)
    return text if text.encoding == Encoding::UTF_8 && text.valid_encoding?
    copy = text.dup.force_encoding(Encoding::UTF_8)
    return copy if copy.valid_encoding?
    text.encode(Encoding::UTF_8, :invalid => :replace, :undef => :replace)
  rescue EncodingError
    copy.scrub
  end

  def self.encode_string(text)
    body = utf8(text).gsub(/[\x00-\x1f"\\]/) do |char|
      ESCAPES[char] || sprintf("\\u%04x", char.unpack("C")[0])
    end
    "\"" + body + "\""
  end

  def self.decode(text)
    text = text.dup.force_encoding(Encoding::UTF_8)
    raise ParseError, "text is not valid UTF-8" unless text.valid_encoding?
    parser = Parser.new(text)
    value = parser.value
    parser.finish
    value
  end

  class Parser
    def initialize(text)
      @text = text
      @pos = 0
    end

    def finish
      skip_space
      raise ParseError, "trailing data at #{@pos}" if @pos < @text.length
    end

    def value
      skip_space
      char = peek
      case char
      when "{" then object
      when "[" then array
      when "\"" then string
      when "t" then literal("true", true)
      when "f" then literal("false", false)
      when "n" then literal("null", nil)
      when nil then raise ParseError, "unexpected end"
      else number
      end
    end

    def peek
      @pos < @text.length ? @text[@pos, 1] : nil
    end

    def expect(char)
      skip_space
      raise ParseError, "expected #{char} at #{@pos}" unless peek == char
      @pos += 1
    end

    def skip_space
      @pos += 1 while @pos < @text.length && " \t\r\n".include?(@text[@pos, 1])
    end

    def literal(word, result)
      raise ParseError, "bad literal at #{@pos}" unless @text[@pos, word.length] == word
      @pos += word.length
      result
    end

    def number
      match = NUMBER.match(@text[@pos, @text.length - @pos])
      raise ParseError, "bad value at #{@pos}" unless match
      @pos += match[0].length
      match[1] || match[2] ? match[0].to_f : match[0].to_i
    end

    def object
      @pos += 1
      result = {}
      skip_space
      if peek == "}"
        @pos += 1
        return result
      end
      loop do
        skip_space
        key = string
        expect(":")
        result[key] = value
        skip_space
        char = peek
        @pos += 1
        return result if char == "}"
        raise ParseError, "expected , or } at #{@pos - 1}" unless char == ","
      end
    end

    def array
      @pos += 1
      result = []
      skip_space
      if peek == "]"
        @pos += 1
        return result
      end
      loop do
        result << value
        skip_space
        char = peek
        @pos += 1
        return result if char == "]"
        raise ParseError, "expected , or ] at #{@pos - 1}" unless char == ","
      end
    end

    def string
      raise ParseError, "expected string at #{@pos}" unless peek == "\""
      @pos += 1
      out = String.new(:encoding => Encoding::UTF_8)
      loop do
        char = peek
        raise ParseError, "unterminated string" if char.nil?
        @pos += 1
        return out if char == "\""
        if char != "\\"
          out << char
          next
        end
        escape = peek
        @pos += 1
        if escape == "u"
          out << [codepoint].pack("U")
        elsif UNESCAPES[escape]
          out << UNESCAPES[escape]
        else
          raise ParseError, "bad escape at #{@pos - 1}"
        end
      end
    end

    def codepoint
      high = hex4
      return high unless high >= 0xD800 && high <= 0xDBFF && @text[@pos, 2] == "\\u"
      @pos += 2
      low = hex4
      0x10000 + ((high - 0xD800) << 10) + (low - 0xDC00)
    end

    def hex4
      digits = @text[@pos, 4]
      raise ParseError, "bad \\u escape at #{@pos}" unless digits =~ /\A[0-9a-fA-F]{4}\z/
      @pos += 4
      digits.hex
    end
  end
end
